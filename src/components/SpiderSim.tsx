/**
 * SpiderSim – Jacobian Damped-Least-Squares IK for the spider.glb rig.
 *
 * Bone hierarchy (Three.js dot-stripped names):
 *   Head            – body / head, tracks cursor (Y-yaw + X-pitch, ±45°)
 *   L1 / L2 / L3 / L4 / R1 / R2 / R3 / R4  – leg roots, no rotation
 *   L1001 … L1005   – active chain; .001 → Z-axis, .002–.005 → X-axis
 *   (same suffix pattern for all 8 legs)
 *
 * Algorithm:
 *   Each frame:
 *     1. Rotate Head to track cursor (smooth lerp, clamped ±45°).
 *     2. For each leg, run N iterations of Jacobian DLS IK to pull the foot
 *        back to its fixed world-space ground target.
 *
 *   Jacobian column for joint i:
 *     J_i = axis_i_world × (EE_world − joint_i_world)
 *
 *   DLS solution:
 *     Δθ = Jᵀ (J Jᵀ + λ²I)⁻¹ Δx
 *
 * Rotations are clamped per joint to the rig's measured bend ranges.
 */

import { useGLTF, Environment } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "./SettingsContext";
import { CanvasStatsReporter } from "./CanvasStats";
import { ControlsPanel, SliderRow } from "./sim";
import * as THREE from "three";

// ── Constants ────────────────────────────────────────────────────────────────
const CLAMP_RAD     = Math.PI / 4;          // 45° hard cap on every joint
const IK_ITER       = 20;                   // Jacobian iterations per leg per frame
const DLS_LAMBDA    = 0.03;                 // damping factor
const DLS_LAMBDA_SQ = DLS_LAMBDA * DLS_LAMBDA;
const HEAD_SMOOTH   = 0.05;                 // head rotation lerp speed
const INACTIVITY_DELAY = 2.0;
const IDLE_BLEND_SPEED = 0.6;
const IDLE_YAW_AMP     = 0.45;
const IDLE_PITCH_AMP   = 0.2;
const MAX_FOOT_LIFT = 0.45;
const IK_FAIL_DISTANCE = 0.12;
const FOOT_LIFT_GAIN = 0.75;
const MAX_JOINT_UPDATE = 0.12;
/** Default bend scale = 100% of the rig's measured joint ranges. */
const DEFAULT_MAX_BEND = 1.0;

interface SpiderParams {
  headSmooth: number;
  bodyLean: number;
  /** Multiplier on per-joint rotation clamps (0.4 = stiff, 1.5 = very flexible). */
  maxBend: number;
}

const DEFAULT_SPIDER_PARAMS: SpiderParams = {
  headSmooth: HEAD_SMOOTH,
  bodyLean: 1.5,
  maxBend: DEFAULT_MAX_BEND,
};

const LEG_NAMES = ["L1", "L2", "L3", "L4", "R1", "R2", "R3", "R4"] as const;

// ── Module-level scratch space (zero per-frame heap alloc) ──────────────────
const _wq   = new THREE.Quaternion();
const _axL  = new THREE.Vector3();   // local rotation axis
const _axW  = new THREE.Vector3();   // world-space rotation axis
const _jPos = new THREE.Vector3();   // joint world position
const _ee   = new THREE.Vector3();   // end-effector world position
const _r    = new THREE.Vector3();   // ee − joint
const _err  = new THREE.Vector3();   // target − ee
const _col  = new THREE.Vector3();   // Jacobian column (axisW × r)

// Jacobian stored as n×3 row-major Float64Array: row = joint, cols = [vx,vy,vz]
const _jBuf = new Float64Array(5 * 3);   // max 5 joints
const _JJT  = new Float64Array(9);       // JJᵀ + λ²I, 3×3 row-major
const _rhs  = new Float64Array(3);       // position error Δx
const _v3   = new Float64Array(3);       // (JJᵀ + λ²I)⁻¹ Δx

// ── 3×3 Cramer solve: (_JJT) · _v3 = _rhs  ─────────────────────────────────
// Reads _JJT and _rhs, writes _v3. Returns false if singular.
function solveDLS3(): boolean {
  const a = _JJT[0], b = _JJT[1], c = _JJT[2];
  const d = _JJT[3], e = _JJT[4], f = _JJT[5];
  const g = _JJT[6], h = _JJT[7], k = _JJT[8];
  const det = a * (e * k - f * h) - b * (d * k - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-10) return false;
  const inv = 1 / det;
  const r0 = _rhs[0], r1 = _rhs[1], r2 = _rhs[2];
  _v3[0] = ((e * k - f * h) * r0 + (c * h - b * k) * r1 + (b * f - c * e) * r2) * inv;
  _v3[1] = ((f * g - d * k) * r0 + (a * k - c * g) * r1 + (c * d - a * f) * r2) * inv;
  _v3[2] = ((d * h - e * g) * r0 + (b * g - a * h) * r1 + (a * e - b * d) * r2) * inv;
  return true;
}

// ── Per-leg data ─────────────────────────────────────────────────────────────
interface LegData {
  joints: THREE.Object3D[];
  isRoot: boolean[];   // true = first/root joint (Z axis), false = bend joint (X axis)
  /** Per-joint [min, max] in radians */
  clamp: [number, number][];
  target: THREE.Vector3;
  groundTarget: THREE.Vector3;
  endLocal: THREE.Vector3;
  groundY: number;
}

function getLowestWorldPoint(root: THREE.Object3D): THREE.Vector3 {
  const best = new THREE.Vector3();
  const v = new THREE.Vector3();
  let bestY = Infinity;

  root.updateWorldMatrix(true, true);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute("position");
    if (!position) return;

    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      if (v.y < bestY) {
        bestY = v.y;
        best.copy(v);
      }
    }
  });

  if (bestY === Infinity) root.getWorldPosition(best);
  return best;
}

// ── Jacobian DLS solver for one leg ──────────────────────────────────────────
function jointLimits(base: [number, number], maxBend: number): [number, number] {
  return [base[0] * maxBend, base[1] * maxBend];
}

function solveOneLeg(leg: LegData, maxBend: number): void {
  const { joints, isRoot, target, endLocal } = leg;
  const n = joints.length;
  if (n === 0) return;

  target.copy(leg.groundTarget);
  for (let attempt = 0; attempt < 2; attempt++) {
    for (let iter = 0; iter < IK_ITER; iter++) {
    // Current end-effector = planted contact point on the visible foot mesh
    joints[n - 1].localToWorld(_ee.copy(endLocal));
    _err.subVectors(target, _ee);
    if (_err.lengthSq() < 1e-7) break;

    // ── Build Jacobian rows (n × 3, row = joint, cols = [vx,vy,vz]) ─────
    for (let i = 0; i < n; i++) {
      joints[i].getWorldQuaternion(_wq);
      _axL.set(isRoot[i] ? 0 : 1, 0, isRoot[i] ? 1 : 0);  // root joint → local Z, others → local X
      _axW.copy(_axL).applyQuaternion(_wq).normalize();
      joints[i].getWorldPosition(_jPos);
      _r.subVectors(_ee, _jPos);
      _col.crossVectors(_axW, _r);   // J column = axis × (ee − joint)
      _jBuf[i * 3 + 0] = _col.x;
      _jBuf[i * 3 + 1] = _col.y;
      _jBuf[i * 3 + 2] = _col.z;
    }

    // ── JJᵀ + λ²I (3 × 3) ────────────────────────────────────────────────
    for (let row = 0; row < 3; row++) {
      for (let col2 = 0; col2 < 3; col2++) {
        let s = 0;
        for (let k = 0; k < n; k++) s += _jBuf[k * 3 + row] * _jBuf[k * 3 + col2];
        _JJT[row * 3 + col2] = s;
      }
    }
    _JJT[0] += DLS_LAMBDA_SQ;
    _JJT[4] += DLS_LAMBDA_SQ;
    _JJT[8] += DLS_LAMBDA_SQ;

    // ── Solve (JJᵀ + λ²I) v = Δx → _v3 ──────────────────────────────────
    _rhs[0] = _err.x;
    _rhs[1] = _err.y;
    _rhs[2] = _err.z;
    if (!solveDLS3()) continue;

    // ── Δθᵢ = Jᵀᵢ · v, apply + asymmetric clamp ─────────────────────────
    for (let i = 0; i < n; i++) {
      const dTheta = _jBuf[i * 3 + 0] * _v3[0]
                   + _jBuf[i * 3 + 1] * _v3[1]
                   + _jBuf[i * 3 + 2] * _v3[2];
      const axis: "z" | "x" = isRoot[i] ? "z" : "x";  // root → Z, others → X
      const [mn, mx] = jointLimits(leg.clamp[i], maxBend);
      const stableTheta = THREE.MathUtils.clamp(dTheta, -MAX_JOINT_UPDATE, MAX_JOINT_UPDATE);
      joints[i].rotation[axis] = THREE.MathUtils.clamp(
        joints[i].rotation[axis] + stableTheta,
        mn,
        mx,
      );
      joints[i].updateWorldMatrix(false, true);
    }
    }

    joints[n - 1].localToWorld(_ee.copy(endLocal));
    _err.subVectors(target, _ee);
    if (attempt === 0 && _err.length() > IK_FAIL_DISTANCE) {
      const lift = Math.min(MAX_FOOT_LIFT, (_err.length() - IK_FAIL_DISTANCE) * FOOT_LIFT_GAIN);
      target.y += lift;
      continue;
    }
    break;
  }

  // ── Floor clamp: lift foot back to groundY if IK left it below ────────
  for (let clamped = 0; clamped < 6; clamped++) {
    joints[n - 1].localToWorld(_ee.copy(endLocal));
    const dy = leg.groundY - _ee.y;
    if (dy < 0.002) break;

    // Build Y-only Jacobian (1-DOF: all joints vs. Y error)
    for (let i = 0; i < n; i++) {
      joints[i].getWorldQuaternion(_wq);
      _axL.set(isRoot[i] ? 0 : 1, 0, isRoot[i] ? 1 : 0);
      _axW.copy(_axL).applyQuaternion(_wq).normalize();
      joints[i].getWorldPosition(_jPos);
      _r.subVectors(_ee, _jPos);
      _col.crossVectors(_axW, _r);
      _jBuf[i * 3 + 0] = _col.y;  // Y component only
    }

    let jjt = DLS_LAMBDA_SQ;
    for (let i = 0; i < n; i++) jjt += _jBuf[i * 3 + 0] * _jBuf[i * 3 + 0];
    if (jjt < 1e-10) break;
    const dTheta = dy / jjt;

    for (let i = 0; i < n; i++) {
      const axis: "z" | "x" = isRoot[i] ? "z" : "x";
      const [mn, mx] = jointLimits(leg.clamp[i], maxBend);
      joints[i].rotation[axis] = THREE.MathUtils.clamp(
        joints[i].rotation[axis] + _jBuf[i * 3 + 0] * dTheta,
        mn, mx,
      );
      joints[i].updateWorldMatrix(false, true);
    }
  }
}

// ── Model-only inner component (suspends while GLTF loads) ───────────────────
function SpiderModel({
  mouseNDC,
  params,
}: {
  mouseNDC: React.RefObject<THREE.Vector2>;
  params: React.MutableRefObject<SpiderParams>;
}) {
  const gltf = useGLTF("/spider3.glb");
  const gl = useThree((s) => s.gl);

  // Soften matte materials so the studio HDRI actually shows up in reflections.
  // NonColor maps on roughness/metalness are correct — they are not the issue.
  useEffect(() => {
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        const m = mat as THREE.MeshStandardMaterial;
        if (!m.isMeshStandardMaterial && !(m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) continue;
        m.envMapIntensity = 1.25;
        // Pull extreme matte finishes slightly into the reflective range
        if (typeof m.roughness === "number") {
          m.roughness = Math.min(m.roughness, 0.85);
        }
        m.needsUpdate = true;
      }
    });
  }, [gltf.scene]);

  // Measure floor height from the GLB ground, but keep it invisible —
  // the scene uses the flat gray background + grid instead.
  const staticGround = useMemo(() => {
    const source = gltf.scene.getObjectByName("ground") ?? null;
    if (!source) return null;
    source.traverse((obj) => {
      obj.visible = false;
    });
    const ground = source.clone(true);
    ground.visible = false;
    ground.traverse((obj) => {
      obj.visible = false;
    });
    return ground;
  }, [gltf.scene]);

  const headRef    = useRef<THREE.Object3D | null>(null);
  const groupRef    = useRef<THREE.Group>(null!);
  const legsRef     = useRef<LegData[]>([]);
  const readyRef    = useRef(false);
  const headYaw     = useRef(0);
  const headPitch   = useRef(0);
  const bodyY       = useRef(0);
  const bodyBaseY   = useRef(0);
  const initDone    = useRef(false);
  const isMouseGone = useRef(true);
  const isInactive  = useRef(false);
  const idleTime    = useRef(0);
  const idleBlend   = useRef(0);

  // ── First-frame init (world matrices are valid inside useFrame) ────────
  useFrame(() => {
    if (initDone.current) return;
    initDone.current = true;

    gltf.scene.updateWorldMatrix(true, true);

    // Bounding box — tells us scale + position
    const box  = new THREE.Box3().setFromObject(gltf.scene);
    const ctr  = new THREE.Vector3();
    const sz   = new THREE.Vector3();
    box.getCenter(ctr);
    box.getSize(sz);
    console.log("[Spider] bbox center:", ctr.toArray().map(v => v.toFixed(3)), "size:", sz.toArray().map(v => v.toFixed(3)));

    // Name → node map
    const nm = new Map<string, THREE.Object3D>();
    gltf.scene.traverse((o) => { if (o.name) nm.set(o.name, o); });
    console.log("[Spider] nodes:", [...nm.keys()].sort().join(", "));

    // Head bone
    headRef.current = nm.get("Head") ?? nm.get("head") ?? null;
    if (!headRef.current) console.warn("[Spider] 'Head' not found");

    // Leg chains
    const legs: LegData[] = [];
    for (const root of LEG_NAMES) {
      const joints: THREE.Object3D[] = [];
      const isRoot: boolean[] = [];
      const clamp: [number, number][] = [];

      for (let i = 1; i <= 5; i++) {
        const padded = String(i).padStart(3, "0");
        const bone = nm.get(`${root}${padded}`)
                  ?? nm.get(`${root}.${padded}`)
                  ?? null;
        if (!bone) continue;
        const useRoot = i === 1;
        joints.push(bone);
        isRoot.push(useRoot);
        // Confirmed axes & ranges (tested on all 8 legs simultaneously).
        // Blender symmetrized armature: same sign works on both sides.
        // Root joint (i=1): Z axis ±30°
        // Bend joints (i=2..5): X axis, same range left and right
        const D = Math.PI / 180;
        const perJoint: [number,number][] = [
          [-60*D,   60*D],   // joint 0 – Z
          [    0,   70*D],   // joint 1 – X
          [-90*D,      0],   // joint 2 – X
          [-90*D,      0],   // joint 3 – X
          [-40*D,      0],   // joint 4 – X
        ];
        clamp.push(perJoint[joints.length - 1] ?? [-CLAMP_RAD, CLAMP_RAD]);
        const axisLabel = useRoot ? 'z' : 'x';
        console.log(`[Spider] ${root}.${padded} axis=${axisLabel} clamp=[${clamp[clamp.length-1].map(v=>v.toFixed(2))}]`);
      }

      if (joints.length === 0) continue;
      legs.push({
        joints,
        isRoot,
        clamp,
        target: new THREE.Vector3(),
        groundTarget: new THREE.Vector3(),
        endLocal: new THREE.Vector3(),
        groundY: 0,
      });
    }

    // ── Measure feet from the GLB's loaded pose (don't reset rotations!) ─
    // Log bone rotations to confirm the pose came through
    for (const leg of legs) {
      const j0 = leg.joints[0];
      console.log(`[Spider] ${j0.name} loaded rot: x=${j0.rotation.x.toFixed(3)} y=${j0.rotation.y.toFixed(3)} z=${j0.rotation.z.toFixed(3)}`);
    }
    gltf.scene.updateWorldMatrix(true, true);

    const groundBox = staticGround ? new THREE.Box3().setFromObject(staticGround) : null;
    const floorY = groundBox ? groundBox.max.y : null;
    bodyY.current     = groupRef.current.position.y;
    bodyBaseY.current = groupRef.current.position.y;
    console.log(`[Spider] base Y = ${bodyBaseY.current.toFixed(3)}, floor Y = ${floorY?.toFixed(3) ?? "none"}`);

    // Set targets from the visible foot contact points in the loaded pose
    for (const leg of legs) {
      const foot = leg.joints[leg.joints.length - 1];
      const contactWorld = getLowestWorldPoint(foot);
      leg.endLocal.copy(foot.worldToLocal(contactWorld.clone()));
      leg.groundTarget.copy(contactWorld);
      if (floorY !== null) leg.groundTarget.y = floorY;
      leg.target.copy(leg.groundTarget);
      leg.groundY = leg.groundTarget.y;
    }

    legsRef.current = legs;
    readyRef.current = headRef.current !== null && legs.length > 0;
    console.log(`[Spider] IK ready: ${readyRef.current} (${legs.length} legs)`);
  });

  // ── Mouse tracking via canvas bounding rect ───────────────────────────
  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    const onMove = (e: MouseEvent) => {
      const el = gl.domElement;
      const rect = el.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom;
      isMouseGone.current = !inside;
      if (inside) {
        isInactive.current = false;
        idleBlend.current = 0;
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => { isInactive.current = true; }, INACTIVITY_DELAY * 1000);
        mouseNDC.current.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -(((e.clientY - rect.top) / rect.height) * 2 - 1),
        );
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (inactivityTimer) clearTimeout(inactivityTimer);
    };
  }, [gl, mouseNDC]);

  // ── Per-frame IK ──────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (!readyRef.current || !headRef.current) return;

    // ── Idle state ──────────────────────────────────────────────────────
    const isIdle = isMouseGone.current || isInactive.current;
    if (isIdle) {
      idleBlend.current = Math.min(idleBlend.current + IDLE_BLEND_SPEED * delta, 1);
      idleTime.current += delta;
      mouseNDC.current.x = THREE.MathUtils.lerp(mouseNDC.current.x, 0, 0.03);
      mouseNDC.current.y = THREE.MathUtils.lerp(mouseNDC.current.y, 0, 0.03);
    } else {
      idleBlend.current = Math.max(idleBlend.current - IDLE_BLEND_SPEED * delta, 0);
    }

    // Yaw (turn head left/right) — cursor X drives head Z rotation
    const tYaw   = THREE.MathUtils.clamp( mouseNDC.current.x * 0.6,  -0.9,  0.9);
    // Pitch (look up/down) — cursor Y drives head X rotation
    const tPitch = THREE.MathUtils.clamp( mouseNDC.current.y * 0.35, -0.08, 0.35);
    // body Y: cursor top → body rises, cursor bottom → body lowers
    const tBodyY = bodyBaseY.current + Math.max(mouseNDC.current.y, -0.4) * params.current.bodyLean;

    // Idle look-around: slow sine waves blended in
    const t = idleTime.current;
    const raw = Math.sin(t * 0.3);
    const shaped = raw >= 0
      ? raw * raw * raw
      : -Math.pow(-raw, 1.2);
    const jitter = Math.sin(t * 0.73) * 0.04;
    const idleYaw   = (shaped + jitter) * IDLE_YAW_AMP * idleBlend.current;
    const idlePitch = Math.sin(t * 0.3 + 1.2) * 0.15 * IDLE_PITCH_AMP * idleBlend.current;

    headYaw.current   = THREE.MathUtils.lerp(headYaw.current,   tYaw + idleYaw,     params.current.headSmooth);
    headPitch.current = THREE.MathUtils.lerp(headPitch.current, tPitch + idlePitch, params.current.headSmooth);
    bodyY.current     = THREE.MathUtils.lerp(bodyY.current,     tBodyY,             params.current.headSmooth);

    groupRef.current.position.y = bodyY.current;

    // Head bone rest rotation: x=-90°, z=-180° (Blender → Three.js)
    // Z axis = yaw (turn left/right), X axis = pitch (look up/down)
    headRef.current.rotation.z = -Math.PI + headYaw.current;
    headRef.current.rotation.x = -Math.PI / 2 - headPitch.current;
    groupRef.current.updateWorldMatrix(true, true);

    for (const leg of legsRef.current) solveOneLeg(leg, params.current.maxBend);
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <primitive object={gltf.scene} />
    </group>
  );
}

// ── Public component ──────────────────────────────────────────────────────────
export default function SpiderSim() {
  const { profile } = useSettings();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseNDC     = useRef(new THREE.Vector2());
  const params       = useRef<SpiderParams>({ ...DEFAULT_SPIDER_PARAMS });
  const [showControls, setShowControls] = useState(false);
  const [headSmooth, setHeadSmooth] = useState(params.current.headSmooth);
  const [bodyLean, setBodyLean] = useState(params.current.bodyLean);
  const [maxBend, setMaxBend] = useState(params.current.maxBend);

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0 }}>
      <Canvas
        shadows={profile.high}
        dpr={profile.dpr}
        camera={{ position: [0, 3.5, 11], fov: 42, near: 0.1, far: 100 }}
        onCreated={({ camera }) => camera.lookAt(0, -0.5, -2)}
        gl={{
          antialias: profile.antialias,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <CanvasStatsReporter />
        {/* ── Always-visible scene scaffold ─────────────────────────────── */}
        <color attach="background" args={["#F5F5F5"]} />
        {/* High quality: studio HDRI + soft key light. Performance: analytic lights only. */}
        {profile.high ? (
          <>
            <ambientLight intensity={0.25} color="#ffffff" />
            <directionalLight position={[6, 10, 4]} intensity={0.55} color="#ffffff" />
            <directionalLight position={[-4, 3, -2]} intensity={0.2} color="#d0e0ff" />
            <Suspense fallback={null}>
              {/* warehouse has stronger specular contrast than studio (softboxes / windows) */}
              <Environment preset="studio" environmentIntensity={0.5} />
            </Suspense>
          </>
        ) : (
          <>
            <ambientLight intensity={0.7} color="#ffffff" />
            <hemisphereLight intensity={0.9} color="#ffffff" groundColor="#cccccc" />
            <directionalLight position={[5, 8, 5]} intensity={1.1} color="#ffffff" />
          </>
        )}

        {/* Grid — visible immediately, confirms canvas is rendering */}
        <gridHelper args={[60, 15, "#BBBBBB", "#DDDDDD"]} position={[0, -2.251, 0]} />

        {/* Ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.251, 0]} visible={false} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#111111" roughness={1} metalness={0} />
        </mesh>

        {/* ── Spider model — suspends until spider.glb is ready ───────────── */}
        <Suspense fallback={null}>
          <SpiderModel mouseNDC={mouseNDC} params={params} />
        </Suspense>
      </Canvas>

      <ControlsPanel open={showControls} onToggle={() => setShowControls((v) => !v)}>
        <div className="grid md:grid-cols-2 gap-4">
          <SliderRow
            label="Head Smooth"
            value={headSmooth}
            display={headSmooth.toFixed(2)}
            min={0.01}
            max={0.2}
            step={0.01}
            onChange={(v) => {
              setHeadSmooth(v);
              params.current.headSmooth = v;
            }}
          />
          <SliderRow
            label="Body Lean"
            value={bodyLean}
            display={bodyLean.toFixed(2)}
            min={0}
            max={3}
            step={0.05}
            onChange={(v) => {
              setBodyLean(v);
              params.current.bodyLean = v;
            }}
          />
          <SliderRow
            label="Max Bend"
            value={maxBend}
            display={`${(maxBend * 100).toFixed(0)}%`}
            min={0.4}
            max={1.5}
            step={0.05}
            onChange={(v) => {
              setMaxBend(v);
              params.current.maxBend = v;
            }}
          />
        </div>
      </ControlsPanel>
    </div>
  );
}

