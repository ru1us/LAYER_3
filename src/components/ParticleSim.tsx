import { useEffect, useMemo, useRef, Suspense, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PauseButton, ControlsPanel, SliderRow } from "./sim";
import { useSettings } from "./SettingsContext";
import { CanvasStatsReporter } from "./CanvasStats";

const COLOR_BG = "#F5F5F5";

// Performance mode limits the O(n²) collision pass.
const BALL_COUNT_HIGH = 200;
const BALL_COUNT_PERF = 70;
const BALL_RADIUS = 30;
const BALL_SCALE  = BALL_RADIUS;
const DIAMETER   = BALL_RADIUS * 2;
const REPULSION_RADIUS   = 180;
const REPULSION_STRENGTH = 4.0;
const MAX_MOUSE_SPEED    = 3;
const DAMPING     = 0.988;
const GRAVITY     = 0.3;
const BOUNDS_X    = 1050;  
const BOUNDS_Z    = 60;    // collision depth
const FLOOR_Y     = -270;
const CEIL_Y      = 300;
const RESTITUTION = 0.78;

interface ParticleParams {
  gravity: number;
  repulsionRadius: number;
  repulsionStrength: number;
}

const DEFAULT_PARTICLE_PARAMS: ParticleParams = {
  gravity: GRAVITY,
  repulsionRadius: REPULSION_RADIUS,
  repulsionStrength: REPULSION_STRENGTH,
};

interface Ball {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  rx: number; ry: number; rz: number; // accumulated euler rotation
  spawnAt: number; // performance.now() timestamp — ball is frozen until this
}

function Particles({ count, high, params }: {
  count: number;
  high: boolean;
  params: React.MutableRefObject<ParticleParams>;
}) {
  const { camera, gl } = useThree();
  const { scene: ballScene } = useGLTF("/ball.glb");

  // Preserve the GLB look while adding sheen.
  const { geom, mat } = useMemo(() => {
    let geom: THREE.BufferGeometry | null = null;
    let srcMat: THREE.MeshStandardMaterial | null = null;
    ballScene.traverse((o) => {
      if (!geom && o instanceof THREE.Mesh) {
        geom = o.geometry;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (m instanceof THREE.MeshStandardMaterial) srcMat = m;
      }
    });

    // Cast needed: TS loses the narrowed type after the traverse callback
    const src = srcMat as THREE.MeshStandardMaterial | null;

    // High quality keeps maps and adds a physical-material sheen.
    const base = {
      map:          high ? (src?.map          ?? null) : null,
      color:        src?.color        ?? new THREE.Color("#ffffff"),
      roughness:    src?.roughness    ?? 0.9,
      metalness:    src?.metalness    ?? 0.0,
      normalMap:    high ? (src?.normalMap    ?? null) : null,
      roughnessMap: high ? (src?.roughnessMap ?? null) : null,
    };

    const mat = high
      ? new THREE.MeshPhysicalMaterial({
          ...base,
          sheen:          1.0,
          sheenRoughness: 0.8,
          sheenColor:     new THREE.Color("#ffffff"),
        })
      : new THREE.MeshStandardMaterial(base);

    return { geom, mat };
  }, [ballScene, high]);

  const meshRef   = useRef<THREE.InstancedMesh>(null);
  const balls     = useRef<Ball[]>([]);
  const mouseNDC  = useRef(new THREE.Vector2(99999, 99999));

  // Reused per-frame objects.
  const dummy      = useRef(new THREE.Object3D());
  const _raycaster = useRef(new THREE.Raycaster());
  const _closest   = useRef(new THREE.Vector3());
  const _ballPos   = useRef(new THREE.Vector3());

  // Stagger spawns above the ceiling.
  useEffect(() => {
    const now = performance.now();
    balls.current = Array.from({ length: count }, (_, i) => ({
      x:  (Math.random() - 0.5) * BOUNDS_X * 2,
      y:  CEIL_Y + BALL_RADIUS + Math.random() * 200, // tight band just above
      z:  (Math.random() - 0.5) * BOUNDS_Z * 2,
      vx: 0, vy: 0, vz: 0,
      rx: Math.random() * Math.PI * 2,
      ry: Math.random() * Math.PI * 2,
      rz: Math.random() * Math.PI * 2,
      spawnAt: now + i * 30, // one new ball every 30 ms
    }));
  }, [count]);

  // Track smoothed pointer speed.
  const mouseMovedAt  = useRef(0);
  const mouseSpeed    = useRef(0);          // smoothed speed in px/ms
  const _prevMousePx  = useRef({ x: 0, y: 0, t: 0 });

  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      mouseNDC.current.set(
        ((e.clientX - rect.left) / rect.width)  * 2 - 1,
        -((e.clientY - rect.top)  / rect.height) * 2 + 1,
      );
      const now = performance.now();
      const dt  = now - _prevMousePx.current.t;
      if (dt > 0 && dt < 100) {             // ignore stale/first samples
        const dx   = e.clientX - _prevMousePx.current.x;
        const dy   = e.clientY - _prevMousePx.current.y;
        const raw  = Math.sqrt(dx * dx + dy * dy) / dt;
        mouseSpeed.current = mouseSpeed.current * 0.6 + raw * 0.4; // EMA smoothing
      }
      _prevMousePx.current = { x: e.clientX, y: e.clientY, t: now };
      mouseMovedAt.current = now;
    };
    const onLeave = () => {
      mouseNDC.current.set(99999, 99999);
      mouseSpeed.current = 0;
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [gl]);

  useFrame(() => {
    if (!meshRef.current || balls.current.length === 0) return;
    const now = performance.now();

    // Build the pointer ray.
    _raycaster.current.setFromCamera(mouseNDC.current, camera);
    const _ray = _raycaster.current.ray;
    // Fade repulsion when the pointer stops.
    const age         = performance.now() - mouseMovedAt.current;
    const speedFactor = age < 150
      ? Math.min(mouseSpeed.current / MAX_MOUSE_SPEED, 1)
      : 0;

    const bs = balls.current;
    const n  = bs.length;

    // Update each ball.
    for (let i = 0; i < n; i++) {
      const b = bs[i];
      if (now < b.spawnAt) continue; // not yet released

      b.vy -= params.current.gravity;

      // Pointer-speed-scaled repulsion.
      if (speedFactor > 0.01) {
        _ballPos.current.set(b.x, b.y, b.z);
        _ray.closestPointToPoint(_ballPos.current, _closest.current);
        const dx = b.x - _closest.current.x;
        const dy = b.y - _closest.current.y;
        const dz = b.z - _closest.current.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < params.current.repulsionRadius && dist > 0.001) {
          const force = ((params.current.repulsionRadius - dist) / params.current.repulsionRadius) * params.current.repulsionStrength * speedFactor;
          b.vx += (dx / dist) * force;
          b.vy += (dy / dist) * force;
          b.vz += (dz / dist) * force;
        }
      }

      b.vx *= DAMPING;
      b.vy *= DAMPING;
      b.vz *= DAMPING;
      b.x  += b.vx;
      b.y  += b.vy;
      b.z  += b.vz;

      if (b.x >  BOUNDS_X) { b.x =  BOUNDS_X; b.vx *= -RESTITUTION; }
      if (b.x < -BOUNDS_X) { b.x = -BOUNDS_X; b.vx *= -RESTITUTION; }
      if (b.z >  BOUNDS_Z) { b.z =  BOUNDS_Z; b.vz *= -RESTITUTION; }
      if (b.z < -BOUNDS_Z) { b.z = -BOUNDS_Z; b.vz *= -RESTITUTION; }
      if (b.y < FLOOR_Y + BALL_RADIUS) { b.y = FLOOR_Y + BALL_RADIUS; b.vy *= -RESTITUTION; }
      if (b.y > CEIL_Y)                { b.y = CEIL_Y;                 b.vy *= -RESTITUTION; }
    }

    // Resolve ball collisions.
    for (let i = 0; i < n - 1; i++) {
      const a = bs[i];
      if (now < a.spawnAt) continue;
      for (let j = i + 1; j < n; j++) {
        const b = bs[j];
        if (now < b.spawnAt) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq >= DIAMETER * DIAMETER || distSq < 0.0001) continue;

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;

        const overlap = (DIAMETER - dist) * 0.5;
        a.x -= nx * overlap; a.y -= ny * overlap; a.z -= nz * overlap;
        b.x += nx * overlap; b.y += ny * overlap; b.z += nz * overlap;

        const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny + (a.vz - b.vz) * nz;
        if (dvn > 0) {
          const impulse = dvn * (1 + RESTITUTION) * 0.5;
          a.vx -= impulse * nx; a.vy -= impulse * ny; a.vz -= impulse * nz;
          b.vx += impulse * nx; b.vy += impulse * ny; b.vz += impulse * nz;
        }
      }
    }

    // Update instance matrices.
    for (let i = 0; i < n; i++) {
      const b = bs[i];      // Hide balls that haven't spawned yet (scale to 0)
      if (now < b.spawnAt) {
        dummy.current.position.set(0, -99999, 0);
        dummy.current.scale.setScalar(0);
        dummy.current.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.current.matrix);
        continue;
      }      dummy.current.position.set(b.x, b.y, b.z);
      dummy.current.scale.setScalar(BALL_SCALE);
      // Rotation is fixed at spawn — no runtime updates
      dummy.current.rotation.set(b.rx, b.ry, b.rz);
      dummy.current.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.current.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!geom || !mat) return null;

  return (
    <>
      <instancedMesh key={count} ref={meshRef} args={[geom, mat, count]} frustumCulled={false} />

    </>
  );
}


export default function ParticleSim() {
  const { profile } = useSettings();
  const sectionRef   = useRef<HTMLElement>(null);
  const [loaded, setLoaded]       = useState(false);
  const [paused, setPaused]       = useState(false);
  const [showControls, setShowControls] = useState(false);
  const params = useRef<ParticleParams>({ ...DEFAULT_PARTICLE_PARAMS });
  const [gravity, setGravity] = useState(params.current.gravity);
  const [repulsionRadius, setRepulsionRadius] = useState(params.current.repulsionRadius);
  const [repulsionStrength, setRepulsionStrength] = useState(params.current.repulsionStrength);

  const ballCount = profile.high ? BALL_COUNT_HIGH : BALL_COUNT_PERF;

  // Custom pointer.
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let timer: ReturnType<typeof setTimeout>;
    const grow = () => { if (dotRef.current) dotRef.current.style.width = dotRef.current.style.height = '20px'; };
    const onMove = (e: MouseEvent) => {
      const d = dotRef.current; if (!d) return;
      const r = section.getBoundingClientRect();
      d.style.left = `${e.clientX - r.left}px`;
      d.style.top  = `${e.clientY - r.top}px`;
      d.classList.remove('hidden');
      d.style.width = d.style.height = '13px';
      clearTimeout(timer);
      timer = setTimeout(grow, 120);
    };
    const onLeave = () => { if (dotRef.current) dotRef.current.classList.add('hidden'); };
    section.addEventListener('mousemove', onMove);
    section.addEventListener('mouseleave', onLeave);
    return () => { section.removeEventListener('mousemove', onMove); section.removeEventListener('mouseleave', onLeave); clearTimeout(timer); };
  }, []);

  // Start near the viewport.
  useEffect(() => {
    if (loaded) return;
    const check = () => {
      const el = sectionRef.current;
      if (!el) return;
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) {
        setLoaded(true);
      }
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [loaded]);

  return (
    <section
      ref={sectionRef}
      className="relative z-10 bg-surface border-t border-border h-[640px] cursor-none"
    >
      <div
        ref={dotRef}
        className="absolute hidden size-5 rounded-full bg-[#111111] pointer-events-none z-30 transition-[width,height] duration-150 ease-in-out"
        style={{ transform: 'translate(-50%, -50%)' }}
      />

      <div className="absolute top-8 left-12 z-10 pointer-events-none">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#999999] mb-2">
          Interactive
        </p>
        <h2 className="font-doto text-4xl text-[#111111]">PARTICLE_SIM</h2>
        <p className="font-mono text-[0.65rem] text-[#999999] mt-2 tracking-[0.1em]">
          hover to repel
        </p>
      </div>

      {loaded && (
        <Canvas
          frameloop={paused ? "never" : "always"}
          dpr={profile.dpr}
          orthographic
          camera={{ position: [0, 60, 500], zoom: 1.2, near: 1, far: 10000 }}
          gl={{ antialias: profile.antialias, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.5 }}
          className="w-full h-full"
          onCreated={({ camera, gl }) => { camera.lookAt(0, -30, 0); gl.setClearColor(COLOR_BG); }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[30, 120, 90]} intensity={2.2} color="#f3ff71" castShadow={false} />
          <pointLight position={[-60, 90, 60]} intensity={1.0} color="#E8FF00" />
          <CanvasStatsReporter />
          <Suspense fallback={null}>
            <Particles count={ballCount} high={profile.high} params={params} />
          </Suspense>
        </Canvas>
      )}

      <ControlsPanel open={showControls} onToggle={() => setShowControls((v) => !v)}>
        <div className="grid md:grid-cols-3 gap-4">
          <SliderRow
            label="Gravity"
            value={gravity}
            display={gravity.toFixed(2)}
            min={0}
            max={0.8}
            step={0.01}
            onChange={(v) => {
              setGravity(v);
              params.current.gravity = v;
            }}
          />
          <SliderRow
            label="Repel Radius"
            value={repulsionRadius}
            display={repulsionRadius.toFixed(0)}
            min={60}
            max={320}
            step={5}
            onChange={(v) => {
              setRepulsionRadius(v);
              params.current.repulsionRadius = v;
            }}
          />
          <SliderRow
            label="Repel Force"
            value={repulsionStrength}
            display={repulsionStrength.toFixed(1)}
            min={0.5}
            max={10}
            step={0.1}
            onChange={(v) => {
              setRepulsionStrength(v);
              params.current.repulsionStrength = v;
            }}
          />
        </div>
      </ControlsPanel>

      <PauseButton paused={paused} onToggle={() => setPaused((p) => !p)} />
    </section>
  );
}
