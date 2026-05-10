import { useEffect, useMemo, useRef, Suspense, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { DebugOverlay } from "./DebugOverlay";

const COLOR_BG = "#F5F5F5";

// ── Constants ──────────────────────────────────────────────────────────────
const BALL_COUNT = 200;
const BALL_RADIUS = 30;           // physics collision radius (world units)
const BALL_SCALE  = BALL_RADIUS;  // render scale – assumes GLB native radius ≈ 1
const DIAMETER   = BALL_RADIUS * 2;
const REPULSION_RADIUS   = 180;
const REPULSION_STRENGTH = 4.0;
const MAX_MOUSE_SPEED    = 3;   // px/ms — above this repulsion is at full strength
const DAMPING     = 0.988;
const GRAVITY     = 0.3;
const BOUNDS_X    = 1050;  
const BOUNDS_Z    = 60;    // collision depth
const FLOOR_Y     = -270;
const CEIL_Y      = 300;
const RESTITUTION = 0.78;

// ── Per-ball state (full 3-D) ──────────────────────────────────────────────
interface Ball {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  rx: number; ry: number; rz: number; // accumulated euler rotation
  spawnAt: number; // performance.now() timestamp — ball is frozen until this
}

// ── Inner scene ───────────────────────────────────────────────────────────
function Particles({ fpsRef, onLoaded }: {
  fpsRef: React.MutableRefObject<number>;
  onLoaded: () => void;
}) {
  const { camera, gl } = useThree();
  const { scene: ballScene } = useGLTF("/ball.glb");

  // Extract geometry + original GLB material properties, then build a
  // MeshPhysicalMaterial on top so we can add sheen without losing the original look.
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

    const mat = new THREE.MeshPhysicalMaterial({
      // Inherit everything from the GLB material
      map:          src?.map          ?? null,
      color:        src?.color        ?? new THREE.Color("#ffffff"),
      roughness:    src?.roughness    ?? 0.9,
      metalness:    src?.metalness    ?? 0.0,
      normalMap:    src?.normalMap    ?? null,
      roughnessMap: src?.roughnessMap ?? null,
      // Add felt-like sheen on top
      sheen:        1.0,
      sheenRoughness: 0.8,
      sheenColor:   new THREE.Color("#ffffff"),
    });

    return { geom, mat };
  }, [ballScene]);

  const meshRef   = useRef<THREE.InstancedMesh>(null);
  const balls     = useRef<Ball[]>([]);
  const mouseNDC  = useRef(new THREE.Vector2(99999, 99999));

  // FPS tracking
  const _frameCount   = useRef(0);
  const _lastFpsTime  = useRef(performance.now());
  const _loadedFired  = useRef(false);

  // Reusable scratch objects — no per-frame allocation
  const dummy      = useRef(new THREE.Object3D());
  const _raycaster = useRef(new THREE.Raycaster());
  const _closest   = useRef(new THREE.Vector3());
  const _ballPos   = useRef(new THREE.Vector3());

  // Initialise balls above the ceiling with a staggered spawn delay
  useEffect(() => {
    const now = performance.now();
    balls.current = Array.from({ length: BALL_COUNT }, (_, i) => ({
      x:  (Math.random() - 0.5) * BOUNDS_X * 2,
      y:  CEIL_Y + BALL_RADIUS + Math.random() * 200, // tight band just above
      z:  (Math.random() - 0.5) * BOUNDS_Z * 2,
      vx: 0, vy: 0, vz: 0,
      rx: Math.random() * Math.PI * 2,
      ry: Math.random() * Math.PI * 2,
      rz: Math.random() * Math.PI * 2,
      spawnAt: now + i * 30, // one new ball every 30 ms
    }));
  }, []);

  // Track mouse NDC + speed (px/ms, EMA-smoothed)
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

    // Build mouse ray — works correctly for both perspective and orthographic cameras
    _raycaster.current.setFromCamera(mouseNDC.current, camera);
    const _ray = _raycaster.current.ray;
    // Scale repulsion by mouse speed — fades to zero when mouse is still
    const age         = performance.now() - mouseMovedAt.current;
    const speedFactor = age < 150
      ? Math.min(mouseSpeed.current / MAX_MOUSE_SPEED, 1)
      : 0;

    const bs = balls.current;

    // ── Per-ball: gravity + mouse repulsion + integrate ──────────────────
    for (let i = 0; i < BALL_COUNT; i++) {
      const b = bs[i];
      if (now < b.spawnAt) continue; // not yet released

      // Gravity
      b.vy -= GRAVITY;

      // 3-D mouse repulsion scaled by how fast the mouse is moving
      if (speedFactor > 0.01) {
        _ballPos.current.set(b.x, b.y, b.z);
        _ray.closestPointToPoint(_ballPos.current, _closest.current);
        const dx = b.x - _closest.current.x;
        const dy = b.y - _closest.current.y;
        const dz = b.z - _closest.current.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < REPULSION_RADIUS && dist > 0.001) {
          const force = ((REPULSION_RADIUS - dist) / REPULSION_RADIUS) * REPULSION_STRENGTH * speedFactor;
          b.vx += (dx / dist) * force;
          b.vy += (dy / dist) * force;
          b.vz += (dz / dist) * force;
        }
      }

      // Damping & integrate
      b.vx *= DAMPING;
      b.vy *= DAMPING;
      b.vz *= DAMPING;
      b.x  += b.vx;
      b.y  += b.vy;
      b.z  += b.vz;

      // Wall bounces
      if (b.x >  BOUNDS_X) { b.x =  BOUNDS_X; b.vx *= -RESTITUTION; }
      if (b.x < -BOUNDS_X) { b.x = -BOUNDS_X; b.vx *= -RESTITUTION; }
      if (b.z >  BOUNDS_Z) { b.z =  BOUNDS_Z; b.vz *= -RESTITUTION; }
      if (b.z < -BOUNDS_Z) { b.z = -BOUNDS_Z; b.vz *= -RESTITUTION; }
      if (b.y < FLOOR_Y + BALL_RADIUS) { b.y = FLOOR_Y + BALL_RADIUS; b.vy *= -RESTITUTION; }
      if (b.y > CEIL_Y)                { b.y = CEIL_Y;                 b.vy *= -RESTITUTION; }
    }

    // ── Ball–ball 3-D collision pass ─────────────────────────────────────
    for (let i = 0; i < BALL_COUNT - 1; i++) {
      const a = bs[i];
      if (now < a.spawnAt) continue;
      for (let j = i + 1; j < BALL_COUNT; j++) {
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

        // Separate
        const overlap = (DIAMETER - dist) * 0.5;
        a.x -= nx * overlap; a.y -= ny * overlap; a.z -= nz * overlap;
        b.x += nx * overlap; b.y += ny * overlap; b.z += nz * overlap;

        // Impulse
        const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny + (a.vz - b.vz) * nz;
        if (dvn > 0) {
          const impulse = dvn * (1 + RESTITUTION) * 0.5;
          a.vx -= impulse * nx; a.vy -= impulse * ny; a.vz -= impulse * nz;
          b.vx += impulse * nx; b.vy += impulse * ny; b.vz += impulse * nz;
        }
      }
    }

    // ── Upload matrices ──────────────────────────────────────────────────
    for (let i = 0; i < BALL_COUNT; i++) {
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

    // ── FPS + first-frame callback ────────────────────────────────────
    if (!_loadedFired.current) { _loadedFired.current = true; onLoaded(); }
    _frameCount.current++;
    const fpsNow = performance.now();
    const fpsElapsed = fpsNow - _lastFpsTime.current;
    if (fpsElapsed >= 500) {
      fpsRef.current = (_frameCount.current / fpsElapsed) * 1000;
      _frameCount.current = 0;
      _lastFpsTime.current = fpsNow;
    }
  });

  if (!geom || !mat) return null;

  return (
    <>
      <instancedMesh ref={meshRef} args={[geom, mat, BALL_COUNT]} frustumCulled={false} />

    </>
  );
}

useGLTF.preload("/ball.glb");

// ── GPU name collector (must live inside Canvas) ──────────────────────────
function GLInfo({ onInfo }: { onInfo: (gpu: string) => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const ctx = gl.getContext() as WebGLRenderingContext;
    const ext = ctx.getExtension("WEBGL_debug_renderer_info");
    const name = ext
      ? (ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string).replace(/\(.*?\)/g, "").trim()
      : "Unknown GPU";
    onInfo(name);
  }, [gl, onInfo]);
  return null;
}

// ── Public component ───────────────────────────────────────────────────────
export default function ParticleSim() {
  const sectionRef   = useRef<HTMLElement>(null);
  const [loaded, setLoaded]       = useState(false);
  const [instanceKey, setInstanceKey] = useState(0);
  const [loadTime, setLoadTime]   = useState<number | null>(null);
  const [gpu, setGpu]             = useState<string | null>(null);
  const loadStartRef = useRef(0);
  const fpsRef       = useRef(0);

  // ── Custom cursor dot ────────────────────────────────────────────────────
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

  const handleLoaded = useCallback(() => {
    setLoadTime(performance.now() - loadStartRef.current);
  }, []);

  const handleReload = useCallback(() => {
    loadStartRef.current = performance.now();
    setLoadTime(null);
    fpsRef.current = 0;
    setInstanceKey((k) => k + 1);
  }, []);

  const handleGpu = useCallback((name: string) => setGpu(name), []);

  // Mount (and start) the sim when the section scrolls close to the viewport
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
      {/* Custom cursor dot */}
      <div
        ref={dotRef}
        className="absolute hidden size-5 rounded-full bg-[#111111] pointer-events-none z-30 transition-[width,height] duration-150 ease-in-out"
        style={{ transform: 'translate(-50%, -50%)' }}
      />

      {/* Label overlay */}
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
          key={instanceKey}
          orthographic
          camera={{ position: [0, 60, 500], zoom: 1.2, near: 1, far: 10000 }}
          gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.5 }}
          className="w-full h-full"
          onCreated={({ camera, gl }) => { camera.lookAt(0, -30, 0); gl.setClearColor(COLOR_BG); }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[30, 120, 90]} intensity={2.2} color="#f3ff71" castShadow={false} />
          <pointLight position={[-60, 90, 60]} intensity={1.0} color="#E8FF00" />
          <GLInfo onInfo={handleGpu} />
          <Suspense fallback={null}>
            <Particles fpsRef={fpsRef} onLoaded={handleLoaded} />
          </Suspense>
        </Canvas>
      )}

      <DebugOverlay
        fpsRef={fpsRef}
        loadTimeMs={loadTime}
        onReload={handleReload}
        stats={[
          { label: "PARTICLES", value: BALL_COUNT },
          { label: "GPU", value: gpu ?? "—" },
        ]}
      />
    </section>
  );
}
