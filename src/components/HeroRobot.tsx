import { useGLTF, Environment, Html } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import { Physics, RigidBody, RapierRigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { BallModel } from "./BallModel";
import { PauseButton, ControlsPanel, SliderRow } from "./sim";
import { useSettings } from "./SettingsContext";
import { CanvasStatsReporter } from "./CanvasStats";

const COLOR_BG = "#F5F5F5";


// Armature → Bone (base) → Bone.001…005 (tip), stacked on Y.

interface BoneConfig {
  axis: "x" | "y" | "z";
  min: number; 
  max: number; 
}

const BONE_FOLLOW: Record<string, number> = {
  "Bone":    0.035,
  "Bone001": 0.045,
  "Bone002": 0.055,
  "Bone003": 0.065,
  "Bone004": 0.075,
  "Bone005": 0.085,
  "Bone006": 0.095, 
};

const TARGET_SMOOTH = 0.08;
const REST_THRESHOLD_Y = -0.75;
const INACTIVITY_DELAY  = 2.0;
const DEFAULT_TARGET    = new THREE.Vector3(-0.5, 0.1, 0.25);
const IDLE_BLEND_SPEED  = 0.6; // ramp speed for idle in/out
const IDLE_BASE_AMP     = 0.3; // Base sweep in radians.

type KinematicsMode = "ik" | "fk";

interface RobotParams {
  targetSmooth: number;
  jointFollow: number;
  idleLean: number;
  /** Multiplier on per-joint rotation clamps (0.3 = stiff, 1.5 = very flexible). */
  maxBend: number;
  /** Per-bone multiplier on top of maxBend (missing = 1). */
  boneBend: Record<string, number>;
  mode: KinematicsMode;
  fkAngles: Record<string, number>;
}

const DEFAULT_ROBOT_PARAMS: RobotParams = {
  targetSmooth: TARGET_SMOOTH,
  jointFollow: 1,
  idleLean: IDLE_BASE_AMP,
  maxBend: 1,
  boneBend: {},
  mode: "ik",
  fkAngles: {},
};

/** Scale a bone's angle limits by maxBend * boneBend.
 *  Unbounded axes (±Infinity): at 100% → no limit; below 100% → ±(scale * full turn). */
function scaledLimits(config: BoneConfig, boneName: string, params: RobotParams): [number, number] {
  const scale = params.maxBend * (params.boneBend[boneName] ?? 1);
  if (!Number.isFinite(config.min) || !Number.isFinite(config.max)) {
    if (scale >= 1) return [-Infinity, Infinity];
    const limit = scale * Math.PI * 2;
    return [-limit, limit];
  }
  return [config.min * scale, config.max * scale];
}

const BONE_CONFIG: Record<string, BoneConfig> = {
  // Base turntable (unbounded: 100% = free spin, <100% = ±fraction of a full turn)
  "Bone": { axis: "y", min: -Infinity, max: Infinity },

  // Arm pitch joints (edit these to limit each joint)
  "Bone001": { axis: "x", min: -Math.PI/2, max: Math.PI/2 },
  "Bone002": { axis: "y", min: -Math.PI/2, max: Math.PI/2},
  "Bone003": { axis: "x", min: 0, max: Math.PI/1.2 },
  "Bone004": { axis: "y", min: -Math.PI/4, max: Math.PI/4 },
  "Bone005": { axis: "x", min: -Math.PI/4, max: Math.PI /4},
  "Bone006": { axis: "y", min: -Math.PI/2, max: Math.PI/2 },
  
  // End-effector empty (no rotation, just position target)
  "endeffector": { axis: "z", min: -Infinity, max: Infinity },
};

const FK_JOINTS = [
  { name: "Bone", label: "Base" },
  { name: "Bone001", label: "Shoulder" },
  { name: "Bone002", label: "Upper Arm" },
  { name: "Bone003", label: "Elbow" },
  { name: "Bone004", label: "Forearm" },
  { name: "Bone005", label: "Wrist" },
  { name: "Bone006", label: "Tool" },
];

const RIG_COLOR = "#e8ff00";

const RIG_OPACITY = 0.72;

function RigSegment({ start, end, opacity }: { start: THREE.Object3D; end: THREE.Object3D; opacity: number }) {
  const segmentRef = useRef<THREE.Mesh>(null);
  const jointRef = useRef<THREE.Mesh>(null);
  const segmentMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const jointMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const startPos = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const midpoint = useRef(new THREE.Vector3());
  const up = useRef(new THREE.Vector3(0, 1, 0));

  useFrame(() => {
    start.getWorldPosition(startPos.current);
    end.getWorldPosition(endPos.current);
    direction.current.subVectors(endPos.current, startPos.current);
    const length = direction.current.length();
    if (!segmentRef.current || !jointRef.current || length === 0) return;
    midpoint.current.addVectors(startPos.current, endPos.current).multiplyScalar(0.5);
    segmentRef.current.position.copy(midpoint.current);
    segmentRef.current.scale.set(1, length, 1);
    segmentRef.current.quaternion.setFromUnitVectors(up.current, direction.current.normalize());
    jointRef.current.position.copy(startPos.current);
    if (segmentMatRef.current) segmentMatRef.current.opacity = opacity;
    if (jointMatRef.current) jointMatRef.current.opacity = opacity;
  });

  return (
    <>
      <mesh ref={segmentRef} renderOrder={20} visible={opacity > 0.01}>
        <cylinderGeometry args={[0.008, 0.008, 1, 8]} />
        <meshBasicMaterial ref={segmentMatRef} color={RIG_COLOR} transparent opacity={opacity} depthTest={false} />
      </mesh>
      <mesh ref={jointRef} renderOrder={21} visible={opacity > 0.01}>
        <sphereGeometry args={[0.018, 10, 10]} />
        <meshBasicMaterial ref={jointMatRef} color={RIG_COLOR} transparent opacity={opacity} depthTest={false} />
      </mesh>
    </>
  );
}

function EndEffectorMarker({ object, opacity }: { object: THREE.Object3D; opacity: number }) {
  const markerRef = useRef<THREE.Group>(null);
  const position = useRef(new THREE.Vector3());

  useFrame(() => {
    object.getWorldPosition(position.current);
    markerRef.current?.position.copy(position.current);
  });

  if (opacity < 0.05) return null;

  return (
    <group ref={markerRef}>
      <Html center position={[0, 0.1, 0]} zIndexRange={[40, 0]} style={{ pointerEvents: "none", opacity, transition: "opacity 0.3s ease" }}>
        <span className="whitespace-nowrap rounded-[5px] border border-text bg-accent px-2 py-1 font-mono text-[0.55rem] font-bold uppercase tracking-[0.12em] text-text">End Effector</span>
      </Html>
    </group>
  );
}

function RobotRig({ chain, opacity }: { chain: THREE.Object3D[]; opacity: number }) {
  return (
    <group>
      {chain.slice(0, -1).map((joint, index) => (
        <RigSegment key={joint.uuid} start={joint} end={chain[index + 1]} opacity={opacity} />
      ))}
      <EndEffectorMarker object={chain[chain.length - 1]} opacity={opacity} />
    </group>
  );
}

function RobotScene({ eeWorldPos, baseWorldPos, crosshairRef, containerRef, high, params, onFkAnglesCaptured, onChainBuilt, rigOpacity }: { eeWorldPos: React.RefObject<THREE.Vector3>; baseWorldPos: React.RefObject<THREE.Vector3>; crosshairRef: React.RefObject<HTMLDivElement | null>; containerRef: React.RefObject<HTMLDivElement | null>; high: boolean; params: React.MutableRefObject<RobotParams>; onFkAnglesCaptured: (angles: Record<string, number>) => void; onChainBuilt: (joints: { name: string; label: string }[]) => void; rigOpacity: number }) {
  const gltf = useGLTF("/robot3.glb");
  const { scene, camera, size, gl } = useThree();
  const glbCamApplied = useRef(false);

  const baseRef = useRef<THREE.Object3D | null>(null);
  const armJointsRef = useRef<THREE.Object3D[]>([]);
  const endEffectorRef = useRef<THREE.Object3D | null>(null);
  const boneConfigRef = useRef<Map<THREE.Object3D, BoneConfig>>(new Map());
  const [visualChain, setVisualChain] = useState<THREE.Object3D[]>([]);
  const mouseNDC = useRef(new THREE.Vector2(0, 0));
  const raycaster = useRef(new THREE.Raycaster());

  const setupBoneConfig = () => {
    const chain = [baseRef.current, ...armJointsRef.current, endEffectorRef.current].filter(Boolean);
    const configMap = new Map<THREE.Object3D, BoneConfig>();
    for (const bone of chain) {
      if (!bone) continue;
      const config = BONE_CONFIG[bone.name];
      configMap.set(bone, config ?? { axis: "z", min: -Infinity, max: Infinity });
    }
    boneConfigRef.current = configMap;
  };

  useEffect(() => {
    scene.background = new THREE.Color(COLOR_BG);

    // Apply GLB camera settings.
    if (!glbCamApplied.current) {
      let glbCam: THREE.PerspectiveCamera | null = null;
      gltf.scene.traverse((obj) => {
        if (!glbCam && obj.type === "PerspectiveCamera")
          glbCam = obj as THREE.PerspectiveCamera;
      });
      if (!glbCam && gltf.cameras?.length) {
        for (const c of gltf.cameras)
          if (c.type === "PerspectiveCamera") {
            glbCam = c as THREE.PerspectiveCamera;
            break;
          }
      }
      if (glbCam) {
        const c = glbCam as THREE.PerspectiveCamera;
        c.updateWorldMatrix(true, false);
        const wp = new THREE.Vector3();
        const wq = new THREE.Quaternion();
        c.getWorldPosition(wp);
        c.getWorldQuaternion(wq);
        const rc = camera as THREE.PerspectiveCamera;
        rc.position.copy(wp);
        rc.quaternion.copy(wq);
        rc.fov = c.fov;
        rc.near = c.near;
        rc.far = c.far;
        rc.updateProjectionMatrix();
        glbCamApplied.current = true;
      }
    }

    // Remove baked lights.
    const glbLights: THREE.Object3D[] = [];
    gltf.scene.traverse((obj) => {
      if ((obj as THREE.Light).isLight) glbLights.push(obj);
    });
    for (const light of glbLights) light.parent?.remove(light);

    // Apply ground clipping and shadows.
    const ROBOT_GROUND_CLIP = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      mesh.castShadow = high;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((mat) => {
        (mat as THREE.Material & { clippingPlanes?: THREE.Plane[] }).clippingPlanes = [ROBOT_GROUND_CLIP];
        mat.needsUpdate = true;
      });
    });

    // Build the kinematic chain.
    const nameMap = new Map<string, THREE.Object3D>();
    gltf.scene.traverse((obj) => { if (obj.name) nameMap.set(obj.name, obj); });

    // Find the base bone — try common name variants
    let base: THREE.Object3D | null = null;
    for (const variant of ["Bone", "Bone_", "Armature_Bone"]) {
      if (nameMap.has(variant)) { base = nameMap.get(variant)!; break; }
    }
    // Fallback: first Bone-type object
    if (!base) {
      gltf.scene.traverse((obj) => {
        if (!base && (obj as THREE.Bone).isBone) base = obj;
      });
    }

    if (base) {
      // Walk the kinematic chain: each link's first Bone child
      const chain: THREE.Object3D[] = [base];
      let current = base;
      while (true) {
        const boneChild = current.children.find(
          (c) => (c as THREE.Bone).isBone || c.name.toLowerCase().includes("bone")
        );
        if (!boneChild) break;
        chain.push(boneChild);
        current = boneChild;
      }

      // First bone = base turntable, middle bones = IK joints, last = end-effector
      if (chain.length >= 3) {
        baseRef.current = chain[0];
        armJointsRef.current = chain.slice(1, -1);
        const ee = nameMap.get("endeffector");
        endEffectorRef.current = ee || chain[chain.length - 1];
        setVisualChain([chain[0], ...chain.slice(1, -1), endEffectorRef.current]);
        setTimeout(() => setupBoneConfig(), 0);
        // Notify parent of bendable joints (base + arm joints, excluding end-effector)
        const bendable = [chain[0], ...chain.slice(1, -1)].filter(Boolean) as THREE.Object3D[];
        onChainBuilt(bendable.map((b) => ({
          name: b.name,
          label: FK_JOINTS.find((j) => j.name === b.name)?.label ?? b.name,
        })));
      } else {
        console.error(`[Robot] chain too short: ${chain.length} bones (need >= 3)`);
      }
    }
  }, [gltf, scene, camera, high]);

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
      }
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseNDC.current.set(x, y);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (inactivityTimer) clearTimeout(inactivityTimer);
    };
  }, [gl]);

  // Reusable vectors
  const _v = useRef({
    target: new THREE.Vector3(),
    eePos: new THREE.Vector3(),
    jointPos: new THREE.Vector3(),
    toEE: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    basePos: new THREE.Vector3(),
  });

  // Pre-allocated CCD scratch objects – avoids 48+ allocs/frame in the solver loop
  const _ccd = useRef({
    axisLocal:  new THREE.Vector3(),
    axisWorld:  new THREE.Vector3(),
    worldQuat:  new THREE.Quaternion(),
    eeProj:     new THREE.Vector3(),
    targetProj: new THREE.Vector3(),
    cross:      new THREE.Vector3(),
  });

  // Pre-allocated per-frame ray/plane helpers
  const _ray = useRef({
    hitGround:      new THREE.Vector3(),
    hitBack:        new THREE.Vector3(),
    camDir:         new THREE.Vector3(),
    backPoint:      new THREE.Vector3(),
    liftedIkTarget: new THREE.Vector3(),
  });

  // Cached joint list + angle arrays (avoids spread + new Array each frame)
  const _allJoints    = useRef<THREE.Object3D[]>([]);
  const _savedAngles  = useRef<number[]>([]);
  const _goalAngles   = useRef<number[]>([]);
  const previousMode  = useRef<KinematicsMode>(params.current.mode);

  // Smooth IK target that lags behind the cursor
  const smoothTarget = useRef(new THREE.Vector3(-0.2, 0.1, 0.15)); // init to default
  const smoothInitialized = useRef(false);

  // 1. Ground plane (horizontal, Y-up) at robot base height
  // 2. Back plane (camera-facing, vertical) just behind the robot
  // We test BOTH and pick the closest valid hit.
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const backPlane = useRef(new THREE.Plane());
  const groundY = useRef(0);

  const isRestMode  = useRef(true);
  const isMouseGone = useRef(true);
  const isInactive  = useRef(false);
  const idleTime    = useRef(0);
  const idleBlend   = useRef(0);
  const wasIdle = useRef(true);
  const frozenEEPos = useRef(new THREE.Vector3(-0.2, 0.1, 0.15));

  useFrame((_, delta) => {
    const base = baseRef.current;
    const armJoints = armJointsRef.current;
    const ee = endEffectorRef.current;
    if (!base || armJoints.length === 0 || !ee) return;

    const v   = _v.current;
    const ccd = _ccd.current;
    const ray = _ray.current;

    // Refresh the cached joint list.
    if (_allJoints.current.length !== armJoints.length + 1) {
      _allJoints.current = [base, ...armJoints];
      _savedAngles.current = new Array(_allJoints.current.length).fill(0);
      _goalAngles.current  = new Array(_allJoints.current.length).fill(0);
    }
    const allJoints = _allJoints.current;

    base.getWorldPosition(v.basePos);
    groundY.current = v.basePos.y;
    groundPlane.current.set(new THREE.Vector3(0, 1, 0), -BALL_RADIUS);

    if (params.current.mode === "fk") {
      if (previousMode.current !== "fk") {
        const capturedAngles: Record<string, number> = {};
        for (const joint of allJoints) {
          const config = boneConfigRef.current.get(joint);
          if (config) capturedAngles[joint.name] = joint.rotation[config.axis];
        }
        params.current.fkAngles = capturedAngles;
        onFkAnglesCaptured(capturedAngles);
      }

      for (const joint of allJoints) {
        const config = boneConfigRef.current.get(joint);
        if (!config) continue;
        const [min, max] = scaledLimits(config, joint.name, params.current);
        const targetAngle = params.current.fkAngles[joint.name] ?? joint.rotation[config.axis];
        joint.rotation[config.axis] = THREE.MathUtils.clamp(targetAngle, min, max);
      }
      base.updateWorldMatrix(true, true);
      ee.getWorldPosition(eeWorldPos.current);
      baseWorldPos.current.copy(v.basePos);
      if (containerRef.current) containerRef.current.style.cursor = "auto";
      if (crosshairRef.current) crosshairRef.current.style.opacity = "0";
      previousMode.current = "fk";
      return;
    }
    if (previousMode.current === "fk" && containerRef.current) {
      containerRef.current.style.cursor = isRestMode.current ? "auto" : "none";
    }
    previousMode.current = "ik";

    // Back plane – reuse pre-allocated vectors
    camera.getWorldDirection(ray.camDir);
    ray.backPoint.copy(v.basePos).addScaledVector(ray.camDir, 0.9);
    backPlane.current.setFromNormalAndCoplanarPoint(
      ray.camDir.clone().negate(),
      ray.backPoint,
    );

    raycaster.current.setFromCamera(mouseNDC.current, camera);
    const r = raycaster.current.ray;

    const gotGround = r.intersectPlane(groundPlane.current, ray.hitGround);
    const gotBack   = r.intersectPlane(backPlane.current,   ray.hitBack);

    if (gotGround && gotBack) {
      const dG = ray.hitGround.distanceToSquared(r.origin);
      const dB = ray.hitBack.distanceToSquared(r.origin);
      v.target.copy(dG < dB ? ray.hitGround : ray.hitBack);
    } else if (gotGround) {
      v.target.copy(ray.hitGround);
    } else if (gotBack) {
      v.target.copy(ray.hitBack);
    } else {
      return;
    }

    // Update rest mode.
    const belowThreshold = mouseNDC.current.y < REST_THRESHOLD_Y;
    const shouldRest = isMouseGone.current || belowThreshold;
    if (shouldRest !== isRestMode.current) {
      isRestMode.current = shouldRest;
      if (containerRef.current) containerRef.current.style.cursor = shouldRest ? "auto" : "none";
      if (crosshairRef.current)  crosshairRef.current.style.opacity = "0";
    }

    const freezeOnInactive = isInactive.current && !isRestMode.current;
    const isIdle = isRestMode.current || freezeOnInactive;

    if (isIdle && !wasIdle.current) {
      if (freezeOnInactive) ee.getWorldPosition(frozenEEPos.current);
      idleTime.current = 0;
    }
    wasIdle.current = isIdle;

    if (isRestMode.current) smoothTarget.current.lerp(DEFAULT_TARGET, 0.03);

    if (isIdle) {
      idleBlend.current = Math.min(idleBlend.current + IDLE_BLEND_SPEED * delta, 1);
      idleTime.current += delta;
    } else {
      idleBlend.current = Math.max(idleBlend.current - IDLE_BLEND_SPEED * delta, 0);
    }

    const maxBackDistance = 0.5;
    if (v.basePos.z - v.target.z > maxBackDistance) v.target.z = v.basePos.z - maxBackDistance;

    if (!smoothInitialized.current) { smoothTarget.current.copy(v.target); smoothInitialized.current = true; }
    if (!isRestMode.current) {
      smoothTarget.current.lerp(v.target, params.current.targetSmooth);
      smoothTarget.current.y = Math.max(smoothTarget.current.y, 0);
    }

    const ikTarget = freezeOnInactive ? frozenEEPos.current : smoothTarget.current;

    // Lift – reuse pre-alloc liftedIkTarget vector
    const lag  = smoothTarget.current.distanceTo(v.target);
    const lift = Math.min(lag * 0.3, 0.06);
    if (lift > 0.001 && !freezeOnInactive) {
      ray.liftedIkTarget.copy(ikTarget).setY(ikTarget.y + lift);
    } else {
      ray.liftedIkTarget.copy(ikTarget);
    }
    const liftedIkTarget = ray.liftedIkTarget;

    // Save pre-solve angles.
    for (let i = 0; i < allJoints.length; i++) {
      const cfg = boneConfigRef.current.get(allJoints[i]);
      _savedAngles.current[i] = cfg ? allJoints[i].rotation[cfg.axis] : 0;
    }

    // Solve base
    const baseConfig = boneConfigRef.current.get(base);
    if (base.parent && baseConfig) {
      const localTarget = base.parent.worldToLocal(liftedIkTarget.clone());
      const desired = Math.atan2(localTarget.x - base.position.x, localTarget.z - base.position.z);
      const [bMin, bMax] = scaledLimits(baseConfig, base.name, params.current);
      base.rotation[baseConfig.axis] = THREE.MathUtils.clamp(desired, bMin, bMax);
      if (idleBlend.current > 0) {
        const t = idleTime.current;
        const raw = Math.sin(t * 0.3);
        const shaped = raw >= 0
          ? raw * raw * raw
          : -Math.pow(-raw, 1.2);
        const jitter = Math.sin(t * 0.73) * 0.04;
        const idleSweep = (shaped + jitter) * params.current.idleLean * idleBlend.current;
        base.rotation[baseConfig.axis] += idleSweep;
      }
      base.updateWorldMatrix(true, true);
    }

    // Full CCD (8 iterations) – zero heap allocations
    for (let iter = 0; iter < 8; iter++) {
      for (let i = armJoints.length - 1; i >= 0; i--) {
        const joint  = armJoints[i];
        const config = boneConfigRef.current.get(joint);
        if (!config) continue;

        ee.getWorldPosition(v.eePos);
        joint.getWorldPosition(v.jointPos);
        v.toEE.copy(v.eePos).sub(v.jointPos);
        v.toTarget.copy(liftedIkTarget).sub(v.jointPos);
        if (v.toEE.lengthSq() < 1e-8 || v.toTarget.lengthSq() < 1e-8) continue;

        // Axis in world space – reuse ccd.axisLocal + ccd.worldQuat
        ccd.axisLocal.set(
          config.axis === "x" ? 1 : 0,
          config.axis === "y" ? 1 : 0,
          config.axis === "z" ? 1 : 0,
        );
        joint.getWorldQuaternion(ccd.worldQuat);
        ccd.axisWorld.copy(ccd.axisLocal).applyQuaternion(ccd.worldQuat).normalize();

        // Project onto constraint plane – reuse ccd.eeProj + ccd.targetProj
        ccd.eeProj.copy(v.toEE).projectOnPlane(ccd.axisWorld);
        ccd.targetProj.copy(v.toTarget).projectOnPlane(ccd.axisWorld);
        if (ccd.eeProj.lengthSq() < 1e-8 || ccd.targetProj.lengthSq() < 1e-8) continue;
        ccd.eeProj.normalize();
        ccd.targetProj.normalize();

        let angle = Math.acos(THREE.MathUtils.clamp(ccd.eeProj.dot(ccd.targetProj), -1, 1));
        ccd.cross.crossVectors(ccd.eeProj, ccd.targetProj);
        if (ccd.cross.dot(ccd.axisWorld) < 0) angle = -angle;

        const [jMin, jMax] = scaledLimits(config, joint.name, params.current);
        joint.rotation[config.axis] = THREE.MathUtils.clamp(
          joint.rotation[config.axis] + angle, jMin, jMax,
        );
        joint.updateWorldMatrix(true, true);
      }
    }

    // Read goal angles
    for (let i = 0; i < allJoints.length; i++) {
      const cfg = boneConfigRef.current.get(allJoints[i]);
      _goalAngles.current[i] = cfg ? allJoints[i].rotation[cfg.axis] : 0;
    }

    // Restore and blend toward solved angles.
    for (let idx = 0; idx < allJoints.length; idx++) {
      const joint = allJoints[idx];
      const cfg   = boneConfigRef.current.get(joint);
      if (!cfg) continue;

      const baseSpeed = (BONE_FOLLOW[joint.name] ?? 0.06) * params.current.jointFollow;
      const speed   = freezeOnInactive
        ? Math.min(baseSpeed * 4, 1)
        : Math.min(baseSpeed, 1);
      const current = _savedAngles.current[idx];
      let goal      = _goalAngles.current[idx];

      let diff = goal - current;
      diff = ((diff + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      goal = current + diff;

      const [lMin, lMax] = scaledLimits(cfg, joint.name, params.current);
      joint.rotation[cfg.axis] = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(current, goal, speed), lMin, lMax,
      );
    }

    base.updateWorldMatrix(true, true);
    ee.getWorldPosition(eeWorldPos.current);
    baseWorldPos.current.copy(v.basePos);

    // Update the crosshair.
    if (crosshairRef.current) {
      const projPos = freezeOnInactive ? frozenEEPos.current : eeWorldPos.current;
      const proj = projPos.clone().project(camera);
      const x = (proj.x + 1) / 2 * size.width;
      const y = (-proj.y + 1) / 2 * size.height;
      crosshairRef.current.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
      crosshairRef.current.style.opacity = proj.z < 1 ? "1" : "0";
    }
  });

  return (
    <>
      {/* Quality-dependent PBR lighting. */}
      {high ? (
        <>
          <ambientLight intensity={0.25} color="#ffffff" />
          <directionalLight
            position={[-4, 11, -6]}
            intensity={0.65}
            color="#ffffff"
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-bias={-0.0004}
            shadow-normalBias={0.02}
            shadow-camera-near={0.5}
            shadow-camera-far={30}
            shadow-camera-left={-4}
            shadow-camera-right={4}
            shadow-camera-top={4}
            shadow-camera-bottom={-4}
          />
          <directionalLight position={[5, 4, 3]} intensity={0.22} color="#d0e0ff" />
          <Environment preset="studio" environmentIntensity={0.5} />
          {/* Shadow floor. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
            <planeGeometry args={[20, 20]} />
            <shadowMaterial transparent opacity={0.35} />
          </mesh>
        </>
      ) : (
        <>
          <ambientLight intensity={0.7} color="#ffffff" />
          <hemisphereLight intensity={0.9} color="#ffffff" groundColor="#cccccc" />
          <directionalLight position={[-4, 11, -6]} intensity={1.0} color="#ffffff" />
        </>
      )}
      <primitive object={gltf.scene} />
      {rigOpacity > 0.01 && visualChain.length > 1 && <RobotRig chain={visualChain} opacity={rigOpacity} />}
    </>
  );
}

// Interactive rigid-body ball.
const BALL_RADIUS = 0.04;
const MAGNET_RANGE = 0.2;
const SPAWN_RANGE_X = 0.4;
const SPAWN_RANGE_Z = 0.4;
const HOLE_RADIUS = 0.052; // just slightly wider than BALL_RADIUS so it's a snug fit

function randomSkySpawn(): [number, number, number] {
  const x = (Math.random() - 0.5) * SPAWN_RANGE_X * 2;
  const y = 2.5 + Math.random() * 0.5;
  const z = (Math.random() - 0.5) * SPAWN_RANGE_Z * 2;
  return [x, y, z];
}

function randomHolePos(): THREE.Vector3 {
  const x = (Math.random() - 0.5) * 0.7;
  const z = 0.15 + Math.random() * 0.5;
  return new THREE.Vector3(x, 0, z);
}

function HoleMarker({ position }: { position: THREE.Vector3 }) {
  return (
    <mesh position={[position.x, 0.002, position.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[HOLE_RADIUS, 48]} />
      <meshBasicMaterial color="black" />
    </mesh>
  );
}

const MAX_BALLS_HIGH = 6;
const MAX_BALLS_PERF = 3;

function InteractiveBall({
  eeWorldPos,
  mouseDown,
  isActive,
  onOffscreen,
  holePosRef,
  onScored,
}: {
  eeWorldPos: React.RefObject<THREE.Vector3>;
  mouseDown: React.RefObject<boolean>;
  isActive: boolean;
  onOffscreen: () => void;
  holePosRef: React.RefObject<THREE.Vector3>;
  onScored: () => void;
}) {
  const rigidRef = useRef<RapierRigidBody>(null);
  const wasHeld = useRef(false);
  const isHeld = useRef(false);
  const prevEEPos = useRef(new THREE.Vector3());
  const initPos = useRef<[number, number, number]>(randomSkySpawn());
  const spawnTime = useRef(performance.now());
  const offscreenFired = useRef(false);
  // Sinking animation: set when ball enters hole, null otherwise
  const sinking = useRef<{ hx: number; hz: number } | null>(null);
  const scoreFired = useRef(false);
  const _ballPos = useRef(new THREE.Vector3()); // pre-alloc, no per-frame heap alloc

  useFrame(({ camera }, delta) => {
    const rb = rigidRef.current;
    if (!rb) return;

    if (sinking.current) {
      const { hx, hz } = sinking.current;
      const cur = rb.translation();
      const newY = cur.y - delta * 1.8;
      rb.setNextKinematicTranslation({ x: hx, y: newY, z: hz });
      if (newY < -0.25 && !scoreFired.current) { scoreFired.current = true; onScored(); }
      return;
    }

    const pos = rb.translation();
    const ballPos = _ballPos.current.set(pos.x, pos.y, pos.z);

    // Detect the ball leaving the screen.
    if (isActive && !offscreenFired.current) {
      const sinceSpawn = performance.now() - spawnTime.current;
      if (sinceSpawn > 1500) {
        const ndc = ballPos.clone().project(camera);
        if (Math.abs(ndc.x) > 1.1 || Math.abs(ndc.y) > 1.1) {
          offscreenFired.current = true;
          onOffscreen();
          return;
        }
      }
    }

    // Detect and pull free balls into the hole.
    if (isActive && !offscreenFired.current && !isHeld.current) {
      const hole = holePosRef.current;
      if (hole && ballPos.y < BALL_RADIUS * 3) {
        const dx = ballPos.x - hole.x;
        const dz = ballPos.z - hole.z;
        const dxz = Math.sqrt(dx * dx + dz * dz);

        if (dxz < HOLE_RADIUS) {
          // Ball is over the hole — make kinematic so physics can't fight the sink
          offscreenFired.current = true;
          rb.setBodyType(2, true); // 2 = KinematicPositionBased
          rb.setNextKinematicTranslation({ x: hole.x, y: ballPos.y, z: hole.z });
          sinking.current = { hx: hole.x, hz: hole.z };
          return;
        }
      }
    }

    if (!isActive) return;

    // Pull the ball toward the end effector.
    if (mouseDown.current) {
      const eePos = eeWorldPos.current;
      const distToEE = ballPos.distanceTo(eePos);
      if (distToEE < MAGNET_RANGE) {
        if (distToEE < 0.06) {
          // Close enough: lock to EE so it follows perfectly
          rb.setTranslation({ x: eePos.x, y: eePos.y, z: eePos.z }, true);
          rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
          rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        } else {
          // Still approaching: velocity pull
          const toEE = eePos.clone().sub(ballPos);
          const speed = Math.min(distToEE * 40, 8);
          const pullVel = toEE.normalize().multiplyScalar(speed);
          rb.setLinvel({ x: pullVel.x, y: pullVel.y, z: pullVel.z }, true);
          rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
        prevEEPos.current.copy(eePos);
        isHeld.current = true;
      }
    } else {
      isHeld.current = false;
    }

    // Apply end-effector velocity on release.
    if (wasHeld.current && !isHeld.current) {
      const eePos = eeWorldPos.current;
      const eeVelocity = eePos.clone().sub(prevEEPos.current).multiplyScalar(60);
      rb.setLinvel({ x: eeVelocity.x, y: eeVelocity.y, z: eeVelocity.z }, true);
    }
    wasHeld.current = isHeld.current;
  });

  return (
    <RigidBody
      ref={rigidRef}
      position={initPos.current}
      colliders="ball"
      restitution={0.85}
      friction={0.6}
      linearDamping={0.05}
      angularDamping={0.1}
      mass={0.1}
      ccd
    >
      <BallModel />
    </RigidBody>
  );
}

function BallSpawner({
  eeWorldPos,
  mouseDown,
  maxBalls,
}: {
  eeWorldPos: React.RefObject<THREE.Vector3>;
  mouseDown: React.RefObject<boolean>;
  maxBalls: number;
}) {
  const [firstId] = useState(() => Date.now());
  const [balls, setBalls] = useState<number[]>([firstId]);
  const [activeId, setActiveId] = useState<number>(firstId);
  const [holePos, setHolePos] = useState(() => randomHolePos());
  const holePosRef = useRef(holePos);

  const spawnNewBall = useCallback(() => {
    const newId = Date.now() + Math.random();
    setBalls(prev => {
      const next = [...prev, newId];
      return next.length > maxBalls ? next.slice(next.length - maxBalls) : next;
    });
    setActiveId(newId);
  }, [maxBalls]);

  const handleOffscreen = useCallback((id: number) => {
    const newId = Date.now() + Math.random();
    setBalls(prev => {
      const without = prev.filter(b => b !== id);
      const next = [...without, newId];
      return next.length > maxBalls ? next.slice(next.length - maxBalls) : next;
    });
    setActiveId(newId);
  }, [maxBalls]);

  const handleScored = useCallback(() => {
    const newHole = randomHolePos();
    holePosRef.current = newHole;
    setHolePos(newHole);
    spawnNewBall();
  }, [spawnNewBall]);

  return (
    <>
      <HoleMarker position={holePos} />
      {balls.map(id => (
        <InteractiveBall
          key={id}
          isActive={id === activeId}
          onOffscreen={() => handleOffscreen(id)}
          onScored={handleScored}
          holePosRef={holePosRef}
          eeWorldPos={eeWorldPos}
          mouseDown={mouseDown}
        />
      ))}
    </>
  );
}

export default function HeroRobot({ showRig = false, presentationMode = false, showGame = true }: { showRig?: boolean; presentationMode?: boolean; showGame?: boolean }) {
  const { profile } = useSettings();
  const eeWorldPos = useRef(new THREE.Vector3());
  const baseWorldPos = useRef(new THREE.Vector3());
  const mouseDown = useRef(false);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const params = useRef<RobotParams>({
    ...DEFAULT_ROBOT_PARAMS,
    boneBend: { ...DEFAULT_ROBOT_PARAMS.boneBend },
    fkAngles: {},
  });
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [controlsPage, setControlsPage] = useState<"main" | "bend">("main");
  const [mode, setMode] = useState<KinematicsMode>(params.current.mode);
  const [targetSmooth, setTargetSmooth] = useState(0.02 + 0.25 - params.current.targetSmooth);
  const [jointFollow, setJointFollow] = useState(params.current.jointFollow);
  const [idleLean, setIdleLean] = useState(params.current.idleLean);
  const [maxBend, setMaxBend] = useState(params.current.maxBend);
  const [boneBend, setBoneBend] = useState<Record<string, number>>({ ...params.current.boneBend });
  const [chainJoints, setChainJoints] = useState<{ name: string; label: string }[]>([]);
  const [fkAngles, setFkAngles] = useState<Record<string, number>>({});
  const [rigOpacity, setRigOpacity] = useState(showRig ? RIG_OPACITY : 0);
  const rigOpacityRef = useRef(showRig ? RIG_OPACITY : 0);

  const maxBalls = profile.high ? MAX_BALLS_HIGH : MAX_BALLS_PERF;

  useEffect(() => {
    const down = () => { mouseDown.current = true; };
    const up = () => { mouseDown.current = false; };
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  useEffect(() => {
    const target = showRig ? RIG_OPACITY : 0;
    if (!presentationMode) {
      rigOpacityRef.current = target;
      setRigOpacity(target);
      return;
    }

    let frame = 0;
    const duration = 1600;
    const from = rigOpacityRef.current;
    const started = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = t * t * (3 - 2 * t);
      const next = from + (target - from) * eased;
      rigOpacityRef.current = next;
      setRigOpacity(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [presentationMode, showRig]);

  return (
    <div ref={containerRef} className="w-full h-full cursor-none">
      <Canvas
        frameloop={paused ? "never" : "always"}
        shadows={profile.high ? "percentage" : false}
        dpr={profile.dpr}
        camera={{ position: [4, 3, 5], fov: 45, near: 0.1, far: 500 }}
        gl={{
          antialias: profile.antialias,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: .8,
          localClippingEnabled: true,
        }}
      >
        <CanvasStatsReporter />
        <Physics gravity={[0, -9.81, 0]}>
          <RobotScene eeWorldPos={eeWorldPos} baseWorldPos={baseWorldPos} crosshairRef={crosshairRef} containerRef={containerRef} high={profile.high} params={params} onFkAnglesCaptured={setFkAngles} onChainBuilt={setChainJoints} rigOpacity={rigOpacity} />
          <gridHelper args={[10, 10, "#BBBBBB", "#DDDDDD"]} position={[0, 0, 0]} />
          {/* Back edge stays open. */}
          <CuboidCollider args={[5, 0.5, 2]} position={[0, -0.5, 1.5]} />
          {showGame && (
            <BallSpawner
              eeWorldPos={eeWorldPos}
              mouseDown={mouseDown}
              maxBalls={maxBalls}
            />
          )}
        </Physics>
      </Canvas>

      <div
        ref={crosshairRef}
        className="absolute top-0 left-0 pointer-events-none opacity-0 will-change-transform"
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="14" y1="0" x2="14" y2="10" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="14" y1="18" x2="14" y2="28" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="0" y1="14" x2="10" y2="14" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="18" y1="14" x2="28" y2="14" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="14" cy="14" r="2.5" stroke="#111111" strokeWidth="1.5" />
        </svg>
      </div>

      {(!presentationMode || showRig) && (
      <ControlsPanel
        open={showControls}
        onToggle={() => {
          if (showControls) setControlsPage("main");
          setShowControls((v) => !v);
        }}
        panelStyle={mode === "fk" ? { backgroundColor: "rgba(245, 245, 245, 0.2)" } : undefined}
      >
        {controlsPage === "main" ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 rounded-[8px] border border-text p-1">
              {(["ik", "fk"] as KinematicsMode[]).map((nextMode) => (
                <button
                  key={nextMode}
                  type="button"
                  onClick={() => {
                    setMode(nextMode);
                    params.current.mode = nextMode;
                  }}
                  className={`cursor-pointer rounded-[5px] px-4 py-2 font-mono text-[0.63rem] font-bold uppercase tracking-[0.12em] transition-colors ${mode === nextMode ? "bg-text text-accent" : "text-text-muted hover:text-text"}`}
                >
                  {nextMode === "ik" ? "Inverse Kinematics" : "Forward Kinematics"}
                </button>
              ))}
            </div>

            {mode === "ik" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <SliderRow
                  label="Target Smooth"
                  value={targetSmooth}
                  display={targetSmooth.toFixed(2)}
                  min={0.02}
                  max={0.25}
                  step={0.01}
                  onChange={(v) => {
                    setTargetSmooth(v);
                    // Slider left = no smoothing (instant), right = max smoothing.
                    // Invert so a higher slider value → lower lerp factor (more smoothing).
                    params.current.targetSmooth = 0.02 + 0.25 - v;
                  }}
                />
                <SliderRow
                  label="Joint Follow"
                  value={jointFollow}
                  display={`${jointFollow.toFixed(1)}×`}
                  min={0.4}
                  max={3}
                  step={0.1}
                  onChange={(v) => {
                    setJointFollow(v);
                    params.current.jointFollow = v;
                  }}
                />
                <SliderRow
                  label="Idle Lean"
                  value={idleLean}
                  display={`${((idleLean * 180) / Math.PI).toFixed(0)}°`}
                  min={0}
                  max={0.8}
                  step={0.01}
                  onChange={(v) => {
                    setIdleLean(v);
                    params.current.idleLean = v;
                  }}
                />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {FK_JOINTS.map(({ name, label }) => {
                  const config = BONE_CONFIG[name];
                  if (!config || (Object.keys(fkAngles).length > 0 && !(name in fkAngles))) return null;
                  const scale = maxBend * (boneBend[name] ?? 1);
                  const min = Number.isFinite(config.min) ? config.min * scale : -Math.PI * 2;
                  const max = Number.isFinite(config.max) ? config.max * scale : Math.PI * 2;
                  const value = THREE.MathUtils.clamp(fkAngles[name] ?? 0, min, max);
                  if (min === max) {
                    return (
                      <div key={name} className="rounded-[8px] border border-border px-3 py-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-muted">
                        <div className="flex justify-between"><span>{label}</span><span>0° fixed</span></div>
                      </div>
                    );
                  }
                  return (
                    <SliderRow
                      key={name}
                      label={`${label} · ${config.axis.toUpperCase()}`}
                      value={value}
                      display={`${THREE.MathUtils.radToDeg(value).toFixed(0)}°`}
                      min={min}
                      max={max}
                      step={THREE.MathUtils.degToRad(1)}
                      onChange={(v) => {
                        const next = { ...fkAngles, [name]: v };
                        setFkAngles(next);
                        params.current.fkAngles = next;
                      }}
                    />
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => setControlsPage("bend")}
              className="flex w-full cursor-pointer items-center justify-between rounded-[8px] border border-text px-4 py-3 text-left transition-colors hover:bg-surface-hover"
            >
              <span className="font-mono text-[0.63rem] font-bold uppercase tracking-[0.12em]">Max Bend</span>
              <span className="flex items-center gap-3 font-mono text-[0.63rem] font-bold text-text-muted">
                {(maxBend * 100).toFixed(0)}%
                <span className="font-doto text-lg text-text">→</span>
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <button
              type="button"
              onClick={() => setControlsPage("main")}
              className="flex cursor-pointer items-center gap-2 font-mono text-[0.63rem] font-bold uppercase tracking-[0.12em] text-text-muted transition-colors hover:text-text"
              aria-label="Back to simulation controls"
            >
              <span className="font-doto text-lg leading-none">←</span>
              Bend Controls
            </button>

            <SliderRow
              label="Overall Max Bend"
              value={maxBend}
              display={`${(maxBend * 100).toFixed(0)}%`}
              min={0.3}
              max={1}
              step={0.05}
              onChange={(v) => {
                setMaxBend(v);
                params.current.maxBend = v;
              }}
            />

            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              {chainJoints.map(({ name, label }) => {
                const config = BONE_CONFIG[name];
                if (!config) return null;
                const value = boneBend[name] ?? 1;
                return (
                  <SliderRow
                    key={name}
                    label={`${label} · ${config.axis.toUpperCase()}`}
                    value={value}
                    display={`${(value * 100).toFixed(0)}%`}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => {
                      const next = { ...boneBend, [name]: v };
                      setBoneBend(next);
                      params.current.boneBend = next;
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </ControlsPanel>
      )}

      {!presentationMode && <PauseButton paused={paused} onToggle={() => setPaused((p) => !p)} />}
    </div>
  );
}


