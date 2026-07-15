import { useGLTF, Environment } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import { Physics, RigidBody, RapierRigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { BallModel } from "./BallModel";
import { PauseButton, ControlsPanel, SliderRow } from "./sim";
import { useSettings } from "./SettingsContext";
import { CanvasStatsReporter } from "./CanvasStats";

const COLOR_BG = "#F5F5F5";


// Armature → Bone (base) → Bone.001 → Bone.002 → Bone.003 → Bone.004 → Bone.005
// All bones are stacked vertically (Y translations).
// Bone.005   = end-effector tip

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

// How fast the IK target smooths toward the cursor (0–1)
const TARGET_SMOOTH = 0.08;
// NDC Y below this → rest mode (tune this value, -1 = bottom edge)
const REST_THRESHOLD_Y = -0.75;
// World-space position the arm idles at in rest mode (slightly elevated)
// Idle animation sequence: wait → wrist flick → look around → return
const INACTIVITY_DELAY  = 2.0;
const DEFAULT_TARGET    = new THREE.Vector3(-0.5, 0.1, 0.25);
const IDLE_BLEND_SPEED  = 0.6; // ramp speed for idle in/out
const IDLE_BASE_AMP     = 0.3; // how much the base sweeps in radians // default rest pose

interface RobotParams {
  targetSmooth: number;
  jointFollow: number;
  idleLean: number;
}

const DEFAULT_ROBOT_PARAMS: RobotParams = {
  targetSmooth: TARGET_SMOOTH,
  jointFollow: 1,
  idleLean: IDLE_BASE_AMP,
};

const BONE_CONFIG: Record<string, BoneConfig> = {
  // Base turntable
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

function RobotScene({ eeWorldPos, baseWorldPos, crosshairRef, containerRef, high, params }: { eeWorldPos: React.RefObject<THREE.Vector3>; baseWorldPos: React.RefObject<THREE.Vector3>; crosshairRef: React.RefObject<HTMLDivElement | null>; containerRef: React.RefObject<HTMLDivElement | null>; high: boolean; params: React.MutableRefObject<RobotParams> }) {
  const gltf = useGLTF("/robot3.glb");
  const { scene, camera, size, gl } = useThree();
  const glbCamApplied = useRef(false);

  const baseRef = useRef<THREE.Object3D | null>(null);
  const armJointsRef = useRef<THREE.Object3D[]>([]);
  const endEffectorRef = useRef<THREE.Object3D | null>(null);
  const boneConfigRef = useRef<Map<THREE.Object3D, BoneConfig>>(new Map());
  const mouseNDC = useRef(new THREE.Vector2(0, 0));
  const raycaster = useRef(new THREE.Raycaster());

  // ── Build bone config map from BONE_CONFIG ────────────────────────────────
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

    // ── GLB camera ──────────────────────────────────────────────────────────
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

    // ── Strip lights baked into the GLB (we use our own lighting setup) ─────
    const glbLights: THREE.Object3D[] = [];
    gltf.scene.traverse((obj) => {
      if ((obj as THREE.Light).isLight) glbLights.push(obj);
    });
    for (const light of glbLights) light.parent?.remove(light);

    // ── Ground clipping only — materials come straight from the GLB ──────────
    const ROBOT_GROUND_CLIP = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((mat) => {
        (mat as THREE.Material & { clippingPlanes?: THREE.Plane[] }).clippingPlanes = [ROBOT_GROUND_CLIP];
        mat.needsUpdate = true;
      });
    });

    // ── Find bone chain ──────────────────────────────────────────────────────
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

      console.log("[Robot] Full bone chain:", chain.map((b) => b.name));

      // First bone = base turntable, middle bones = IK joints, last = end-effector
      if (chain.length >= 3) {
        baseRef.current = chain[0];
        armJointsRef.current = chain.slice(1, -1);
        const ee = nameMap.get("endeffector");
        endEffectorRef.current = ee || chain[chain.length - 1];
        setTimeout(() => setupBoneConfig(), 0);
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

    // ── Ensure cached joint list is up to date ─────────────────────────────
    if (_allJoints.current.length !== armJoints.length + 1) {
      _allJoints.current = [base, ...armJoints];
      _savedAngles.current = new Array(_allJoints.current.length).fill(0);
      _goalAngles.current  = new Array(_allJoints.current.length).fill(0);
    }
    const allJoints = _allJoints.current;

    base.getWorldPosition(v.basePos);
    groundY.current = v.basePos.y;
    groundPlane.current.set(new THREE.Vector3(0, 1, 0), -BALL_RADIUS);

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

    // ── Rest mode ───────────────────────────────────────────────────────────
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

    // ── PHASE 1: Save current angles ───────────────────────────────────────
    for (let i = 0; i < allJoints.length; i++) {
      const cfg = boneConfigRef.current.get(allJoints[i]);
      _savedAngles.current[i] = cfg ? allJoints[i].rotation[cfg.axis] : 0;
    }

    // Solve base
    const baseConfig = boneConfigRef.current.get(base);
    if (base.parent && baseConfig) {
      const localTarget = base.parent.worldToLocal(liftedIkTarget.clone());
      const desired = Math.atan2(localTarget.x - base.position.x, localTarget.z - base.position.z);
      base.rotation[baseConfig.axis] = THREE.MathUtils.clamp(desired, baseConfig.min, baseConfig.max);
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

        joint.rotation[config.axis] = THREE.MathUtils.clamp(
          joint.rotation[config.axis] + angle, config.min, config.max,
        );
        joint.updateWorldMatrix(true, true);
      }
    }

    // Read goal angles
    for (let i = 0; i < allJoints.length; i++) {
      const cfg = boneConfigRef.current.get(allJoints[i]);
      _goalAngles.current[i] = cfg ? allJoints[i].rotation[cfg.axis] : 0;
    }

    // ── PHASE 2: Restore + lerp ────────────────────────────────────────────
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

      joint.rotation[cfg.axis] = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(current, goal, speed), cfg.min, cfg.max,
      );
    }

    base.updateWorldMatrix(true, true);
    ee.getWorldPosition(eeWorldPos.current);
    baseWorldPos.current.copy(v.basePos);

    // ── Crosshair ──────────────────────────────────────────────────────────
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
      {/* High quality: studio HDRI + soft key light. Performance: analytic lights only. */}
      {high ? (
        <>
          <ambientLight intensity={0.25} color="#ffffff" />
          <directionalLight position={[6, 10, 4]} intensity={0.55} color="#ffffff" />
          <directionalLight position={[-4, 3, -2]} intensity={0.2} color="#d0e0ff" />
          <Environment preset="studio" environmentIntensity={0.5} />
        </>
      ) : (
        <>
          <ambientLight intensity={0.7} color="#ffffff" />
          <hemisphereLight intensity={0.9} color="#ffffff" groundColor="#cccccc" />
          <directionalLight position={[5, 8, 5]} intensity={1.1} color="#ffffff" />
        </>
      )}
      <primitive object={gltf.scene} />
    </>
  );
}

// ── Interactive Ball with rigid body ─────────────────────────────────────────
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

    // ── Active ball: detect leaving screen ──────────────────────────────
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

    // ── Hole suction + detection (only when ball is free) ────────────────
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

    // ── Only active ball responds to magnet & throw ──────────────────────
    if (!isActive) return;

    // ── Magnet: pull ball toward EE, snap when close enough ─────────────
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

    // ── Drop ball on release: give it EE throw velocity ─────────────────
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

export default function HeroRobot() {
  const { profile } = useSettings();
  const eeWorldPos = useRef(new THREE.Vector3());
  const baseWorldPos = useRef(new THREE.Vector3());
  const mouseDown = useRef(false);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const params = useRef<RobotParams>({ ...DEFAULT_ROBOT_PARAMS });
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [targetSmooth, setTargetSmooth] = useState(params.current.targetSmooth);
  const [jointFollow, setJointFollow] = useState(params.current.jointFollow);
  const [idleLean, setIdleLean] = useState(params.current.idleLean);

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

  return (
    <div ref={containerRef} className="w-full h-full cursor-none">
      <Canvas
        frameloop={paused ? "never" : "always"}
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
          <RobotScene eeWorldPos={eeWorldPos} baseWorldPos={baseWorldPos} crosshairRef={crosshairRef} containerRef={containerRef} high={profile.high} params={params} />
          {/* Grid floor */}
          <gridHelper args={[10, 10, "#BBBBBB", "#DDDDDD"]} position={[0, 0, 0]} />
          {/* Ground collider – cut at back edge so balls roll off */}
          <CuboidCollider args={[5, 0.5, 2]} position={[0, -0.5, 1.5]} />
          <BallSpawner
            eeWorldPos={eeWorldPos}
            mouseDown={mouseDown}
            maxBalls={maxBalls}
          />
        </Physics>
      </Canvas>

      {/* Crosshair at projected IK target */}
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

      <ControlsPanel open={showControls} onToggle={() => setShowControls((v) => !v)}>
        <div className="grid md:grid-cols-3 gap-4">
          <SliderRow
            label="Target Smooth"
            value={targetSmooth}
            display={targetSmooth.toFixed(2)}
            min={0.02}
            max={0.25}
            step={0.01}
            onChange={(v) => {
              setTargetSmooth(v);
              params.current.targetSmooth = v;
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
      </ControlsPanel>

      {/* Pause button */}
      <PauseButton paused={paused} onToggle={() => setPaused((p) => !p)} />
    </div>
  );
}


