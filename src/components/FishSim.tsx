import { useRef, Suspense, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

// ── Simulation parameters (exported for external control) ─────────────────
export interface SimParams {
  maxBend: number;       // max bend angle per segment in radians
  orbitRadius: number;   // target orbit radius in world units
  forceStrength: number; // speed / force multiplier (1 = default)
  followSpeed: number;   // bone slerp factor per frame (0–1)
}
export const DEFAULT_SIM_PARAMS: SimParams = {
  maxBend: Math.PI * 0.25,
  orbitRadius: 1.44,
  forceStrength: 1.0,
  followSpeed: 0.4,
};

// ── FABRIK forward-only mit Winkelconstraint ──────────────────────────────
// chain[0] = head (follows target), chain[N-1] = tail (drags behind)
// maxBend = max Biegewinkel pro Segment in Radiant
function solveFABRIKForward(
  joints: THREE.Vector2[],
  segLengths: number[],
  target: THREE.Vector2,
  maxBend = Math.PI * 0.25, // ~45°
) {
  joints[0].copy(target);
  for (let i = 1; i < joints.length; i++) {
    // Richtung von vorherigem zu diesem Joint
    let dir = joints[i].clone().sub(joints[i - 1]);
    if (dir.lengthSq() < 1e-10) dir.set(0, 1);
    dir.normalize();

    // Winkelconstraint relativ zum vorigen Segment
    if (i >= 2) {
      const prevDir = joints[i - 1].clone().sub(joints[i - 2]).normalize();
      const cross = prevDir.x * dir.y - prevDir.y * dir.x; // 2D cross
      const dot   = prevDir.dot(dir);
      const angle = Math.atan2(cross, dot);
      const clamped = Math.max(-maxBend, Math.min(maxBend, angle));
      const cos = Math.cos(clamped);
      const sin = Math.sin(clamped);
      dir.set(
        prevDir.x * cos - prevDir.y * sin,
        prevDir.x * sin + prevDir.y * cos,
      );
    }

    joints[i].copy(joints[i - 1]).addScaledVector(dir, segLengths[i - 1]);
  }
}

// ── Fish inner scene ───────────────────────────────────────────────────────
function FishScene({
  ndcMouse,
  mouseInCanvas,
  params,
}: {
  ndcMouse: React.MutableRefObject<THREE.Vector2>;
  mouseInCanvas: React.MutableRefObject<boolean>;
  params: React.MutableRefObject<SimParams>;
}) {
  const { scene } = useGLTF("/fih.glb");
  const fishTexture = useTexture("/fishtexture.png");
  const { camera, scene: r3fScene } = useThree();

  // Textur auf alle SkinnedMesh-Materialien anwenden
  useEffect(() => {
    fishTexture.flipY = false;
    fishTexture.needsUpdate = true;
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.SkinnedMesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        const mat = m as THREE.MeshStandardMaterial;
        mat.map = fishTexture;
        mat.needsUpdate = true;
      });
    });
  }, [scene, fishTexture]);

  const spineBones    = useRef<THREE.Bone[]>([]);
  const restQuats     = useRef<THREE.Quaternion[]>([]); // lokale Rest-Quaternions
  const restWorldQ    = useRef<THREE.Quaternion[]>([]); // Welt-Rest-Quaternions
  const bonesReady    = useRef(false);

  const SPINE   = 6; // Bone … Bone005
  const joints  = useRef<THREE.Vector2[]>(Array.from({ length: SPINE }, () => new THREE.Vector2()));
  const displayJoints = useRef<THREE.Vector2[]>(Array.from({ length: SPINE }, () => new THREE.Vector2())); // pre-alloc
  const segLens = useRef<number[]>(new Array(SPINE - 1).fill(1));
  const smoothTgt    = useRef(new THREE.Vector2(0, 0));
  const fishPos      = useRef(new THREE.Vector2(0, 0)); // aktuelle Fischposition
  const fishVel      = useRef(new THREE.Vector2(0, 0)); // Geschwindigkeitsvektor
  const prevSpeed    = useRef(0);
  const swimMomentum = useRef(0);
  const wanderAngle  = useRef(0); // Kreisschwimmen wenn Cursor außerhalb

  // reusable objects – allocated once
  const _raycaster = useRef(new THREE.Raycaster());
  const _swimPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const _hit       = useRef(new THREE.Vector3());

  function initBones() {
    r3fScene.updateMatrixWorld(true);

    const boneMap: Record<number, THREE.Bone> = {};
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Bone)) return;
      const name = obj.name;
      if (name === "Bone") { boneMap[0] = obj; return; }
      const m = name.match(/^Bone(\d+)$/);
      if (!m) return;
      const idx = parseInt(m[1], 10);
      if (idx <= 5) boneMap[idx] = obj; // skip fins
    });

    // Build ordered chain: head (Bone=0) → tail (Bone005=5)
    const chain: THREE.Bone[] = [];
    for (let i = 0; i <= 5; i++) {
      if (boneMap[i]) chain.push(boneMap[i]);
    }
    if (chain.length < 2) return;

    spineBones.current = chain;
    // Lokale + Welt-Rest-Quaternions speichern
    restQuats.current  = chain.map(b => b.quaternion.clone());
    restWorldQ.current = chain.map(b => {
      const wq = new THREE.Quaternion();
      b.getWorldQuaternion(wq);
      return wq;
    });

    // Seed joints from world positions
    let totalLen = 0;
    for (let i = 0; i < chain.length - 1; i++) {
      const a = new THREE.Vector3(); const b = new THREE.Vector3();
      chain[i].getWorldPosition(a);
      chain[i + 1].getWorldPosition(b);
      const len = a.distanceTo(b);
      segLens.current[i] = len > 0.0001 ? len : 0.3;
      totalLen += segLens.current[i];
      joints.current[i].set(a.x, a.z);
    }
    const lastPos = new THREE.Vector3();
    chain[chain.length - 1].getWorldPosition(lastPos);
    joints.current[chain.length - 1].set(lastPos.x, lastPos.z);

    if (totalLen < 0.0001) return; // world matrices not ready yet, retry

    // Start smooth target + fish position at head position
    smoothTgt.current.copy(joints.current[0]);
    fishPos.current.copy(joints.current[0]);
    fishVel.current.set(0, 0.01);
    bonesReady.current = true;
    console.log("[FishSim] ✓ ready – chain:", chain.length, "totalLen:", totalLen.toFixed(3));
  }

  // End-Effector-Visualisierung
  const effectorRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!bonesReady.current) { initBones(); return; }
    void state.clock.elapsedTime; // unused but kept for future use

    // ── Steering Behavior (Nature of Code) ───────────────────────────────
    _raycaster.current.setFromCamera(ndcMouse.current, camera);
    const hit = _raycaster.current.ray.intersectPlane(_swimPlane.current, _hit.current);

    if (mouseInCanvas.current) {
      // Cursor im Canvas → normales Tracking
      if (hit) smoothTgt.current.set(hit.x, hit.z);
    } else {
      // Cursor außerhalb → Kreis um aktuelle Fischposition
      wanderAngle.current += 0.012;
      const WANDER_R = 2.2;
      smoothTgt.current.set(
        fishPos.current.x + Math.cos(wanderAngle.current) * WANDER_R,
        fishPos.current.y + Math.sin(wanderAngle.current) * WANDER_R,
      );
    }

    const MAX_FORCE_BASE = 0.0018 * params.current.forceStrength;
    const ORBIT_R        = params.current.orbitRadius;

    const toTarget = smoothTgt.current.clone().sub(fishPos.current);
    const dist     = toTarget.length();

    // Geschwindigkeit: nah am Cursor → langsam, weit weg → schnell
    const distFactor = Math.min(dist / ORBIT_R, 1.5);
    const speedScale = 0.1 + distFactor * 0.7; // auf Orbit-Radius = 0.8×, weit weg = 1.15×
    const MAX_SPEED  = 0.07 * speedScale;
    const MAX_FORCE  = MAX_FORCE_BASE * speedScale;

    if (dist > 0.001) {
      // Seek: je weiter weg, desto stärker anziehen
      const seekStrength = Math.min(dist / 8, 1);
      const desired = toTarget.clone().normalize().multiplyScalar(MAX_SPEED * seekStrength);

      // Orbit: senkrechte Kraft – Seite anhand aktueller Velocity wählen
      const cross2d = toTarget.x * fishVel.current.y - toTarget.y * fishVel.current.x;
      const perpSign = cross2d >= 0 ? 1 : -1;
      const perp = new THREE.Vector2(-toTarget.y * perpSign, toTarget.x * perpSign).normalize();
      const orbitFactor = (dist - ORBIT_R) / ORBIT_R;
      const orbitForce = perp.clone().multiplyScalar(MAX_SPEED * 0.85)
        .addScaledVector(toTarget.clone().normalize(), orbitFactor * MAX_SPEED * 0.4);

      // Blende zwischen Seek (weit weg) und Orbit (in der Nähe)
      const orbitWeight = Math.max(0, 1 - Math.abs(dist - ORBIT_R) / (ORBIT_R * 2));
      const steerTarget = desired.clone().lerp(orbitForce, orbitWeight);

      // Steering = gewünschte Geschwindigkeit - aktuelle
      const steer = steerTarget.clone().sub(fishVel.current);
      if (steer.length() > MAX_FORCE) steer.normalize().multiplyScalar(MAX_FORCE);

      fishVel.current.add(steer);
    }

    // Geschwindigkeit begrenzen
    if (fishVel.current.length() > MAX_SPEED) {
      fishVel.current.normalize().multiplyScalar(MAX_SPEED);
    }

    fishPos.current.add(fishVel.current);

    // Momentum aus aktueller Geschwindigkeit
    const speed = fishVel.current.length();
    prevSpeed.current = speed;
    swimMomentum.current = Math.min(speed / MAX_SPEED, 1);

    const fabrikTarget = fishPos.current.clone();

    // ── FABRIK auf persistenten joints (KEIN Wave-Offset hier!) ───────────
    solveFABRIKForward(joints.current, segLens.current, fabrikTarget, params.current.maxBend);

    // displayJoints = direkte Kopie (keine Welle, pre-allocated)
    for (let i = 0; i < joints.current.length; i++) {
      displayJoints.current[i].copy(joints.current[i]);
    }

    // ── Root-Bone zu Kopfposition bewegen ─────────────────────────────────
    const bones = spineBones.current;
    const rootParent = bones[0]?.parent;
    if (rootParent) {
      rootParent.updateWorldMatrix(true, false);
      const invParent = new THREE.Matrix4().copy(rootParent.matrixWorld).invert();
      const targetWorld = new THREE.Vector3(
        displayJoints.current[0].x, bones[0].position.y, displayJoints.current[0].y,
      );
      const localTarget = targetWorld.clone().applyMatrix4(invParent);
      bones[0].position.set(localTarget.x, bones[0].position.y, localTarget.z);
    }

    // ── Rotationen anwenden (aus displayJoints) ───────────────────────────
    let parentWorldQ = new THREE.Quaternion();
    if (rootParent) rootParent.getWorldQuaternion(parentWorldQ);

    for (let i = 0; i < bones.length - 1; i++) {
      const dx = displayJoints.current[i + 1].x - displayJoints.current[i].x;
      const dz = displayJoints.current[i + 1].y - displayJoints.current[i].y;
      if (Math.abs(dx) < 1e-8 && Math.abs(dz) < 1e-8) continue;

      // Rest-Forward-Richtung dieses Knochens in der Welt (XZ-Projektion)
      const localFwd = new THREE.Vector3(0, 1, 0);
      localFwd.applyQuaternion(restWorldQ.current[i]);
      const restYaw = Math.atan2(localFwd.x, localFwd.z);

      // Gewünschter Welt-Yaw aus FABRIK
      const desiredYaw = Math.atan2(dx, dz);

      // Delta: wie viel muss sich der Knochen gegenüber seiner Ruhepose drehen
      const deltaYaw = desiredYaw - restYaw;

      // Welt-Zielquaternion = Rest-Weltpose + Delta um Welt-Y
      const qDelta   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaYaw);
      const qDesiredWorld = qDelta.clone().multiply(restWorldQ.current[i]);

      // In lokalen Raum umrechnen
      const qLocal   = parentWorldQ.clone().invert().multiply(qDesiredWorld);
      const qClamped = bones[i].quaternion.clone().slerp(qLocal, params.current.followSpeed);
      bones[i].quaternion.copy(qClamped);
      parentWorldQ = parentWorldQ.clone().multiply(qClamped);
    }

    // ── End-Effector aktualisieren ─────────────────────────────────────────
    if (effectorRef.current) {
      effectorRef.current.position.set(fabrikTarget.x, 0.5, fabrikTarget.y);
    }
  });

  return (
    <>
      <primitive object={scene} />
      {/* End-Effector */}
      <mesh ref={effectorRef}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshBasicMaterial color="#ffe600" depthTest={false} />
      </mesh>
    </>
  );
}

// ── Public component ───────────────────────────────────────────────────────
export default function FishSim({ paramsRef }: { paramsRef?: React.MutableRefObject<SimParams> }) {
  const internalParamsRef = useRef<SimParams>(DEFAULT_SIM_PARAMS);
  const params = paramsRef ?? internalParamsRef;
  const ndcMouse      = useRef(new THREE.Vector2(0, 0));
  const mouseInCanvas = useRef(false);
  const sectionRef    = useRef<HTMLElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [paused, setPaused] = useState(false);

  // Mount canvas only once section is near viewport (same pattern as ParticleSim)
  useEffect(() => {
    if (loaded) return;
    const check = () => {
      const el = sectionRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      console.log("[FishSim] scroll check – top:", top, "threshold:", window.innerHeight * 1.1);
      if (top < window.innerHeight * 1.1) {
        console.log("[FishSim] → mounting canvas");
        setLoaded(true);
      }
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [loaded]);

  function onMouseMove(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    ndcMouse.current.set(
      ((e.clientX - rect.left) / rect.width)  *  2 - 1,
     -((e.clientY - rect.top)  / rect.height) *  2 + 1
    );
  }

  return (
    <section
      ref={sectionRef}
      className="relative z-10 bg-[#000000] border-t border-border h-160"
      onMouseMove={onMouseMove}
      onMouseEnter={() => { mouseInCanvas.current = true; }}
      onMouseLeave={() => { mouseInCanvas.current = false; }}
    >
      {/* SVG-Wasserfilter Definition */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id="water-distort" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.008 0.014"
              numOctaves="2"
              seed="5"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                dur="9s"
                values="0.008 0.014;0.011 0.018;0.007 0.012;0.008 0.014"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="22"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Label */}
      <div className="absolute top-8 left-12 z-10 pointer-events-none">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#555555] mb-2">
          Interactive
        </p>
        <h2 className="font-doto text-4xl text-[#ffffff]">FISH_IK</h2>
        <p className="font-mono text-[0.65rem] text-[#555555] mt-2 tracking-widest">
          FABRIK inverse kinematics · follow cursor
        </p>
      </div>

      {/* Pause button */}
      <button
        onClick={() => setPaused((p) => !p)}
        className="absolute bottom-6 right-6 z-20 flex items-center gap-2 rounded-full border border-[#333] bg-[#111]/80 px-4 py-1.5 font-mono text-[0.65rem] uppercase tracking-widest text-[#888] backdrop-blur-sm transition-colors hover:border-[#666] hover:text-[#ccc]"
      >
        {paused ? "▶ Resume" : "⏸ Pause"}
      </button>

      {loaded && (
        <div style={{ filter: "url(#water-distort)" }} className="w-full h-full">
          {/* Grid background – innerhalb des Wasserfilters */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, #1c1c1c 1px, transparent 1px),
                linear-gradient(to bottom, #1c1c1c 1px, transparent 1px)
              `,
              backgroundSize: "96px 96px",
            }}
          />
          <Canvas
          frameloop={paused ? "never" : "always"}
          orthographic
          camera={{ position: [0, 200, 0], zoom: 52.5, near: 1, far: 1000 }}
          gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
          className="w-full h-full"
          onCreated={({ camera, gl }) => {
            camera.lookAt(0, 0, 0);
            gl.setClearColor(0x000000, 0); // transparent
          }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[0, 10, 5]}  intensity={2.0} color="#ffffff" />
          <directionalLight position={[0, 10, -5]} intensity={0.6} color="#4488ff" />

          <Suspense fallback={null}>
            <FishScene ndcMouse={ndcMouse} mouseInCanvas={mouseInCanvas} params={params} />
          </Suspense>
        </Canvas>
        </div>
      )}
    </section>
  );
}
