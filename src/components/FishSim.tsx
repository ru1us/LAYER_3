import { useRef, Suspense, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PauseButton, ControlsPanel, SliderRow, ToggleRow } from "./sim";
import { useSettings } from "./SettingsContext";
import { CanvasStatsReporter } from "./CanvasStats";

export interface SimParams {
  maxBend: number;
  orbitRadius: number;
  forceStrength: number;
  followSpeed: number;
}
export const DEFAULT_SIM_PARAMS: SimParams = {
  maxBend: Math.PI * (30 / 180),
  orbitRadius: 1.44,
  forceStrength: 1.0,
  followSpeed: 0.4,
};

// Forward-only FABRIK: the head follows while the tail drags.
function solveFABRIKForward(
  joints: THREE.Vector2[],
  segLengths: number[],
  target: THREE.Vector2,
  maxBend = Math.PI * 0.25, // ~45°
) {
  joints[0].copy(target);
  for (let i = 1; i < joints.length; i++) {
    let dir = joints[i].clone().sub(joints[i - 1]);
    if (dir.lengthSq() < 1e-10) dir.set(0, 1);
    dir.normalize();

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

function CameraZoom({ zoom }: { zoom: number }) {
  const { camera } = useThree();
  useEffect(() => {
    (camera as THREE.OrthographicCamera).zoom = zoom;
    (camera as THREE.OrthographicCamera).updateProjectionMatrix();
  }, [camera, zoom]);
  return null;
}

function FishScene({
  ndcMouse,
  mouseInCanvas,
  params,
  shadowEnabled,
  showEffector,
}: {
  ndcMouse: React.MutableRefObject<THREE.Vector2>;
  mouseInCanvas: React.MutableRefObject<boolean>;
  params: React.MutableRefObject<SimParams>;
  shadowEnabled: boolean;
  showEffector: boolean;
}) {
  const { scene } = useGLTF("/fish.glb");
  const { camera, scene: r3fScene } = useThree();

  useEffect(() => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.castShadow = shadowEnabled;
    });
  }, [scene, shadowEnabled]);

  useEffect(() => {
    return () => {
      // useGLTF caches the scene, so restore the shared rig before this
      // deferred canvas unmounts. Otherwise the next mount starts mid-turn.
      spineBones.current.forEach((bone, index) => {
        const restPosition = restPositions.current[index];
        const restQuat = restQuats.current[index];
        if (restPosition) bone.position.copy(restPosition);
        if (restQuat) bone.quaternion.copy(restQuat);
      });
      scene.updateMatrixWorld(true);
    };
  }, [scene]);

  const spineBones    = useRef<THREE.Bone[]>([]);
  const restQuats     = useRef<THREE.Quaternion[]>([]);
  const restPositions  = useRef<THREE.Vector3[]>([]);
  const restWorldQ    = useRef<THREE.Quaternion[]>([]);
  const bonesReady    = useRef(false);

  const SPINE   = 13; // Bone … Bone.012
  const joints  = useRef<THREE.Vector2[]>(Array.from({ length: SPINE }, () => new THREE.Vector2()));
  const displayJoints = useRef<THREE.Vector2[]>(Array.from({ length: SPINE }, () => new THREE.Vector2())); // pre-alloc
  const segLens = useRef<number[]>(new Array(SPINE - 1).fill(1));
  const smoothTgt    = useRef(new THREE.Vector2(0, 0));
  const fishPos      = useRef(new THREE.Vector2(0, 0));
  const fishVel      = useRef(new THREE.Vector2(0, 0));
  const wanderAngle  = useRef(0);
  const smoothVel     = useRef(new THREE.Vector2()); // EMA velocity for banking
  const prevSmoothVel = useRef(new THREE.Vector2());
  const targetRoll    = useRef(0); // heavily smoothed roll target
  const currentRoll   = useRef(0); // spring-smoothed roll applied to bones
  const closeHoldTime = useRef(0);
  const pushAwayActive = useRef(false);

  // Reused raycasting objects.
  const _raycaster = useRef(new THREE.Raycaster());
  const _swimPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const _hit       = useRef(new THREE.Vector3());

  function initBones() {
    r3fScene.updateMatrixWorld(true);

    const boneMap: Record<number, THREE.Bone> = {};
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Bone)) return;
      const name = obj.name.trim().toLowerCase();
      if (name === "bone") { boneMap[0] = obj; return; }
      const m = name.match(/^bone[._]?(\d{3}|\d+)$/);
      if (!m) return;
      const idx = parseInt(m[1], 10);
      if (idx > 0 && idx < SPINE) boneMap[idx] = obj;
    });

    // Build ordered chain: head (Bone=0) → tail (Bone.012=12)
    const chain: THREE.Bone[] = [];
    for (let i = 0; i < SPINE; i++) {
      if (boneMap[i]) chain.push(boneMap[i]);
    }
    if (chain.length < 2) return;

    spineBones.current = chain;
    // Save local and world rest rotations.
    restQuats.current  = chain.map(b => b.quaternion.clone());
    restPositions.current = chain.map(b => b.position.clone());
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
  }

  const effectorRef = useRef<THREE.Mesh>(null!);

  useFrame((_state, delta) => {
    if (!bonesReady.current) { initBones(); return; }

    // Steering behavior.
    _raycaster.current.setFromCamera(ndcMouse.current, camera);
    const hit = _raycaster.current.ray.intersectPlane(_swimPlane.current, _hit.current);

    if (mouseInCanvas.current) {
      // Track the pointer inside the canvas.
      if (hit) smoothTgt.current.set(hit.x, hit.z);
    } else {
      // Orbit when the pointer leaves.
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

    // ── Hover on EE → after 0.5s push fish (EE) away from cursor ─────────
    const CLOSE_R = 0.75;
    const PUSH_HOLD_S = 0.5;
    const dt = Math.min(delta, 0.05); // clamp frame spikes
    if (mouseInCanvas.current && dist < CLOSE_R) {
      closeHoldTime.current += dt;
      if (closeHoldTime.current >= PUSH_HOLD_S) pushAwayActive.current = true;
    } else {
      closeHoldTime.current = 0;
      pushAwayActive.current = false;
    }

    // Normal distance scale: far → faster
    const distFactor = Math.min(dist / ORBIT_R, 1.5);
    let speedScale = 0.12 + distFactor * 0.75;

    // Super-local slowdown only when really close to the EE (catch/hover).
    // At dist=0 → ~4% speed; fully recovered by ~0.35 world units.
    // Skip slowdown while actively pushing away so the fish can leave.
    const closeT = Math.min(dist / CLOSE_R, 1);
    // smoothstep: holds nearly-stopped zone near the EE, then ramps back up
    const closeBlend = closeT * closeT * (3 - 2 * closeT);
    if (!pushAwayActive.current) {
      speedScale *= 0.04 + 0.96 * closeBlend;
    }

    const MAX_SPEED  = 0.07 * speedScale;
    const MAX_FORCE  = MAX_FORCE_BASE * speedScale;

    if (pushAwayActive.current && dist > 0.001) {
      // Flee: shove EE away from cursor after prolonged hover
      const fleeDir = toTarget.clone().normalize().multiplyScalar(-1);
      const pushSpeed = 0.09 * params.current.forceStrength;
      const desired = fleeDir.multiplyScalar(pushSpeed);
      const steer = desired.sub(fishVel.current);
      const pushMaxForce = MAX_FORCE_BASE * 4;
      if (steer.length() > pushMaxForce) steer.normalize().multiplyScalar(pushMaxForce);
      fishVel.current.add(steer);
    } else if (dist > 0.001) {
      // Increase attraction with distance.
      const seekStrength = Math.min(dist / 8, 1);
      const desired = toTarget.clone().normalize().multiplyScalar(MAX_SPEED * seekStrength);

      // Choose orbit direction from velocity.
      const cross2d = toTarget.x * fishVel.current.y - toTarget.y * fishVel.current.x;
      const perpSign = cross2d >= 0 ? 1 : -1;
      const perp = new THREE.Vector2(-toTarget.y * perpSign, toTarget.x * perpSign).normalize();
      const orbitFactor = (dist - ORBIT_R) / ORBIT_R;
      const orbitForce = perp.clone().multiplyScalar(MAX_SPEED * 0.85)
        .addScaledVector(toTarget.clone().normalize(), orbitFactor * MAX_SPEED * 0.4);

      // Blend Seek ↔ Orbit, but kill orbit influence when sitting on the EE
      // so hover/catch no longer spins the fish wildly.
      const orbitWeight =
        Math.max(0, 1 - Math.abs(dist - ORBIT_R) / (ORBIT_R * 2)) * closeBlend;
      const steerTarget = desired.clone().lerp(orbitForce, orbitWeight);

      // Steering is desired minus current velocity.
      const steer = steerTarget.clone().sub(fishVel.current);
      if (steer.length() > MAX_FORCE) steer.normalize().multiplyScalar(MAX_FORCE);

      fishVel.current.add(steer);
    } else {
      // Exactly on target: bleed residual velocity so it settles instead of looping
      fishVel.current.multiplyScalar(0.8);
    }

    // Extra friction while inside the close zone (stabilizes catch/hover)
    // Not while pushing away — fish needs to leave cleanly.
    if (!pushAwayActive.current && dist < CLOSE_R) {
      fishVel.current.multiplyScalar(0.72 + 0.28 * closeBlend);
    }

    // Raise the speed cap while fleeing.
    const speedCap = pushAwayActive.current
      ? 0.09 * params.current.forceStrength
      : MAX_SPEED;
    if (fishVel.current.length() > speedCap) {
      fishVel.current.normalize().multiplyScalar(speedCap);
    }

    fishPos.current.add(fishVel.current);

    const speed = fishVel.current.length();

    // Smooth turn rate before applying a uniform banking roll.
    const MAX_ROLL = Math.PI * 0.28; // ~50°
    if (speed > 0.0015) {
      // Soft-follow raw velocity so steering noise is filtered before angle math
      smoothVel.current.lerp(fishVel.current, 0.12);

      if (prevSmoothVel.current.lengthSq() > 1e-8 && smoothVel.current.lengthSq() > 1e-8) {
        const cross = prevSmoothVel.current.x * smoothVel.current.y
          - prevSmoothVel.current.y * smoothVel.current.x;
        const dot = prevSmoothVel.current.dot(smoothVel.current);
        const turnAngle = Math.atan2(cross, dot);

        // Deadzone: ignore micro turns that would read as wobble
        const DEADZONE = 0.0008;
        let instant = 0;
        if (Math.abs(turnAngle) > DEADZONE) {
          // Gain: still visible on real corners, but not twitchy
          instant = THREE.MathUtils.clamp(turnAngle * 14, -MAX_ROLL, MAX_ROLL);
        }
        // Heavy EMA on the target so direction flips don't pop
        targetRoll.current = THREE.MathUtils.lerp(targetRoll.current, instant, 0.08);
      }
      prevSmoothVel.current.copy(smoothVel.current);
    } else {
      smoothVel.current.set(0, 0);
      prevSmoothVel.current.set(0, 0);
      targetRoll.current = THREE.MathUtils.lerp(targetRoll.current, 0, 0.06);
    }

    // Slow spring toward target — one clean lean, no wiggle
    currentRoll.current = THREE.MathUtils.lerp(currentRoll.current, targetRoll.current, 0.07);
    currentRoll.current = THREE.MathUtils.clamp(currentRoll.current, -MAX_ROLL, MAX_ROLL);

    const fabrikTarget = fishPos.current.clone();

    // Solve persistent joints without a wave offset.
    solveFABRIKForward(joints.current, segLens.current, fabrikTarget, params.current.maxBend);

    // Copy into the preallocated display chain.
    for (let i = 0; i < joints.current.length; i++) {
      displayJoints.current[i].copy(joints.current[i]);
    }

    // Move the root bone to the head.
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

    // Apply display-chain rotations.
    let parentWorldQ = new THREE.Quaternion();
    if (rootParent) rootParent.getWorldQuaternion(parentWorldQ);

    for (let i = 0; i < bones.length - 1; i++) {
      const dx = displayJoints.current[i + 1].x - displayJoints.current[i].x;
      const dz = displayJoints.current[i + 1].y - displayJoints.current[i].y;
      if (Math.abs(dx) < 1e-8 && Math.abs(dz) < 1e-8) continue;

      // Project the bone's rest direction onto XZ.
      const localFwd = new THREE.Vector3(0, 1, 0);
      localFwd.applyQuaternion(restWorldQ.current[i]);
      const restYaw = Math.atan2(localFwd.x, localFwd.z);

      // Get the desired world yaw.
      const desiredYaw = Math.atan2(dx, dz);

      // Normalize the rest-pose delta across ±π.
      const rawDeltaYaw = desiredYaw - restYaw;
      const deltaYaw = Math.atan2(Math.sin(rawDeltaYaw), Math.cos(rawDeltaYaw));

      // Rotate the world rest pose by the yaw delta.
      const qDelta = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaYaw);
      let qDesiredWorld = qDelta.clone().multiply(restWorldQ.current[i]);

      // Same bank angle on every bone → rigid body lean, no relative twist/wiggle.
      // (Per-bone fade + noisy roll was what made corners shimmer.)
      if (Math.abs(currentRoll.current) > 1e-5) {
        const forwardAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(qDesiredWorld);
        const rollQ = new THREE.Quaternion().setFromAxisAngle(forwardAxis, currentRoll.current);
        qDesiredWorld = rollQ.multiply(qDesiredWorld);
      }

      // Convert to local space.
      const qLocal   = parentWorldQ.clone().invert().multiply(qDesiredWorld);
      const qClamped = bones[i].quaternion.clone().slerp(qLocal, params.current.followSpeed);
      bones[i].quaternion.copy(qClamped);
      parentWorldQ = parentWorldQ.clone().multiply(qClamped);
    }

    // Update the end effector.
    if (effectorRef.current) {
      effectorRef.current.position.set(fabrikTarget.x, 0.5, fabrikTarget.y);
    }
  });

  return (
    <>
      <primitive object={scene} />
      {shadowEnabled && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <shadowMaterial transparent opacity={0.42} />
        </mesh>
      )}
      {showEffector && (
        <mesh ref={effectorRef}>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshBasicMaterial color="#ffe600" depthTest={false} />
        </mesh>
      )}
    </>
  );
}

export default function FishSim({ paramsRef }: { paramsRef?: React.MutableRefObject<SimParams> }) {
  const { profile } = useSettings();
  const internalParamsRef = useRef<SimParams>(DEFAULT_SIM_PARAMS);
  const params = paramsRef ?? internalParamsRef;
  const ndcMouse      = useRef(new THREE.Vector2(0, 0));
  const bgTitleRef    = useRef<HTMLDivElement>(null);
  const bgGridRef     = useRef<HTMLDivElement>(null);
  const bgParallaxTarget = useRef(new THREE.Vector2(0, 0));
  const bgParallaxCurrent = useRef(new THREE.Vector2(0, 0));
  const mouseInCanvas = useRef(false);
  const sectionRef    = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [maxBendDeg, setMaxBendDeg] = useState((params.current.maxBend * 180) / Math.PI);
  const [forceStrength, setForceStrength] = useState(params.current.forceStrength);
  const [showEffector, setShowEffector] = useState(false);
  const [zoom, setZoom] = useState(120);

  // Shadows follow the global render-quality setting (high quality only).
  const shadowsOn = profile.high;

  function updateMaxBendDeg(nextDeg: number) {
    setMaxBendDeg(nextDeg);
    params.current.maxBend = (nextDeg * Math.PI) / 180;
  }

  function updateForceStrength(next: number) {
    setForceStrength(next);
    params.current.forceStrength = next;
  }

  function updateZoom(next: number) {
    setZoom(next);
  }


  useEffect(() => {
    let raf = 0;

    const tick = () => {
      const current = bgParallaxCurrent.current;
      const target = bgParallaxTarget.current;
      current.lerp(target, 0.16);

      if (bgTitleRef.current) {
        bgTitleRef.current.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;
      }
      if (bgGridRef.current) {
        bgGridRef.current.style.transform = `translate3d(${current.x * 0.55}px, ${current.y * 0.55}px, 0)`;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function onMouseMove(e: React.MouseEvent) {
    mouseInCanvas.current = true;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    ndcMouse.current.set(
      ((e.clientX - rect.left) / rect.width)  *  2 - 1,
     -((e.clientY - rect.top)  / rect.height) *  2 + 1
    );

    bgParallaxTarget.current.set(-ndcMouse.current.x * 24, ndcMouse.current.y * 14);
  }

  return (
    <div className="relative z-10 bg-bg border-b border-border">
      <section
        ref={sectionRef}
        className="relative bg-bg h-screen"
        onMouseMove={onMouseMove}
        onMouseEnter={() => { mouseInCanvas.current = true; }}
        onMouseLeave={() => {
          mouseInCanvas.current = false;
          bgParallaxTarget.current.set(0, 0);
        }}
      >
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
                dur="14s"
                values="0.0075 0.0125;0.0085 0.0135;0.0072 0.012;0.0075 0.0125"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="16"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <PauseButton paused={paused} onToggle={() => setPaused((p) => !p)} />

      <ControlsPanel open={showControls} onToggle={() => setShowControls((v) => !v)}>
        <div className="grid md:grid-cols-2 gap-4">
          <SliderRow
            label="Max Bend"
            value={maxBendDeg}
            display={`${maxBendDeg.toFixed(0)}°`}
            min={5}
            max={60}
            step={1}
            onChange={updateMaxBendDeg}
          />
          <ToggleRow
            label="Show End Effector"
            value={showEffector}
            onChange={setShowEffector}
          />
          <SliderRow
            label="Force Strength"
            value={forceStrength}
            display={forceStrength.toFixed(2)}
            min={0.3}
            max={2}
            step={0.01}
            onChange={updateForceStrength}
          />
          <SliderRow
            label="Zoom"
            value={zoom}
            display={zoom.toFixed(0)}
            min={60}
            max={200}
            step={1}
            onChange={updateZoom}
          />
        </div>
      </ControlsPanel>

      <div style={profile.high ? { filter: "url(#water-distort)" } : undefined} className="relative z-10 w-full h-full">
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center px-8">
              <div ref={bgTitleRef} className="text-center opacity-70 will-change-transform">
                <h1 className="font-doto text-[10rem] md:text-[13rem] leading-none text-[#111310]">LAYER_3</h1>
                <p className="font-mono text-body text-[#444444] mt-4 max-w-120 mx-auto">
                  An interactive introduction to inverse kinematics. Rendered live in the browser with Three.js.
                </p>
              </div>
            </div>
          </div>

          <div
            ref={bgGridRef}
            className="absolute inset-0 z-[5] pointer-events-none will-change-transform"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(0, 0, 0, 0.08) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0, 0, 0, 0.08) 1px, transparent 1px)
              `,
              backgroundSize: "96px 96px",
            }}
          />
          <Canvas
          frameloop={paused ? "never" : "always"}
          dpr={profile.dpr}
          orthographic
          shadows={shadowsOn ? "percentage" : false}
          camera={{ position: [0, 200, 0], zoom: 120, near: 1, far: 1000 }}
          gl={{ antialias: profile.antialias, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
          className="relative z-10 w-full h-full"
          onCreated={({ camera, gl }) => {
            camera.lookAt(0, 0, 0);
            gl.setClearColor(0x000000, 0); // transparent
          }}
        >
          <CanvasStatsReporter />
          <CameraZoom zoom={zoom} />
          <ambientLight intensity={shadowsOn ? 0.38 : 0.6} />
          <directionalLight position={[0, 10, 5]}  intensity={1.0} color="#ffffff" />
          <directionalLight position={[0, 10, -5]} intensity={0.6} color="#c9ddff" />
          {shadowsOn && (
            <directionalLight
              position={[16, 11, 10]}
              intensity={1.15}
              color="#ffffff"
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-bias={-0.0004}
              shadow-normalBias={0.02}
              shadow-camera-near={1}
              shadow-camera-far={80}
              shadow-camera-left={-24}
              shadow-camera-right={24}
              shadow-camera-top={24}
              shadow-camera-bottom={-24}
            />
          )}

          <Suspense fallback={null}>
            <FishScene ndcMouse={ndcMouse} mouseInCanvas={mouseInCanvas} params={params} shadowEnabled={shadowsOn} showEffector={showEffector} />
          </Suspense>
        </Canvas>
        </div>
      </section>
    </div>
  );
}
