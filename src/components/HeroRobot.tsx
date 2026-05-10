import { useGLTF, Environment } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import { Physics, RigidBody, RapierRigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { BallModel } from "./BallModel";

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
const IDLE_BLEND_SPEED  = 0.3; // ramp speed for idle in/out
const IDLE_BASE_AMP     = 0.25; // how much the base sweeps in radians // default rest pose


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

function RobotScene({ eeWorldPos, baseWorldPos, crosshairRef, containerRef }: { eeWorldPos: React.RefObject<THREE.Vector3>; baseWorldPos: React.RefObject<THREE.Vector3>; crosshairRef: React.RefObject<HTMLDivElement | null>; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const gltf = useGLTF("/robot2.glb");
  const { scene, camera, size } = useThree();
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
      if (config) {
        configMap.set(bone, config);
        console.log(`[Robot] Config for "${bone.name}": axis=${config.axis}, limits=[${config.min.toFixed(2)}, ${config.max.toFixed(2)}]`);
      } else {
        console.warn(`[Robot] No config for "${bone.name}" — add to BONE_CONFIG or using default z-axis`);
        configMap.set(bone, { axis: "z", min: -Infinity, max: Infinity });
      }
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

    // ── Apply roughness map texture to all materials ──────────────────────────
    const textureLoader = new THREE.TextureLoader();
    const ROBOT_GROUND_CLIP = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    textureLoader.load("/metalroughness.png", (roughnessTexture) => {
      roughnessTexture.colorSpace = THREE.SRGBColorSpace;
      gltf.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat) => {
            if ("roughness" in mat) {
              (mat as any).roughnessMap = roughnessTexture;
              (mat as any).roughness = 1.0;
            }
            (mat as any).clippingPlanes = [ROBOT_GROUND_CLIP];
            mat.needsUpdate = true;
          });
        }
      });
      console.log("[Robot] Roughness map applied to all materials");
    });

    // ── Print hierarchy for debugging ───────────────────────────────────────
    console.groupCollapsed("[Robot] Scene hierarchy");
    const printTree = (obj: THREE.Object3D, depth = 0) => {
      const p = new THREE.Vector3();
      obj.getWorldPosition(p);
      console.log(
        "  ".repeat(depth) +
          `${obj.type.padEnd(20)} "${obj.name}" (${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`
      );
      obj.children.forEach((ch) => printTree(ch, depth + 1));
    };
    printTree(gltf.scene);
    console.groupEnd();

    const nameMap = new Map<string, THREE.Object3D>();
    gltf.scene.traverse((obj) => {
      if (obj.name) nameMap.set(obj.name, obj);
    });

    console.log("[Robot] All node names:", [...nameMap.keys()]);

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
        armJointsRef.current = chain.slice(1, -1); // everything between base and tip
        
        // Try to find explicit endeffector object
        const ee = nameMap.get("endeffector");
        endEffectorRef.current = ee || chain[chain.length - 1];

        // Update config on initial setup
        setTimeout(() => setupBoneConfig(), 0);
      }
    }

    console.log("[Robot] Base:", baseRef.current?.name);
    console.log("[Robot] Arm joints:", armJointsRef.current.map((j) => j.name));
    console.log("[Robot] End-effector:", endEffectorRef.current?.name);
  }, [gltf, scene, camera]);

  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    const onMove = (e: MouseEvent) => {
      isMouseGone.current = false;
      isInactive.current = false;
      idleBlend.current = 0;
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => { isInactive.current = true; }, INACTIVITY_DELAY * 1000);
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseNDC.current.set(x, y);
    };
    const onLeave = (e: MouseEvent) => {
      if (e.relatedTarget === null) {
        isMouseGone.current = true;
        isInactive.current = false;
        if (inactivityTimer) clearTimeout(inactivityTimer);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
      if (inactivityTimer) clearTimeout(inactivityTimer);
    };
  }, []);

  // Reusable vectors
  const _v = useRef({
    target: new THREE.Vector3(),
    eePos: new THREE.Vector3(),
    jointPos: new THREE.Vector3(),
    toEE: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    basePos: new THREE.Vector3(),
  });

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

    const v = _v.current;

    base.getWorldPosition(v.basePos);
    groundY.current = v.basePos.y;
    // Ground plane raised by ball radius so grabbed ball sits on the surface
    groundPlane.current.set(new THREE.Vector3(0, 1, 0), -BALL_RADIUS);
    // Back plane: camera-facing, 30cm behind the robot
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const backPoint = v.basePos.clone().addScaledVector(camDir, 0.9);
    if (backPlane.current) backPlane.current.setFromNormalAndCoplanarPoint(camDir.clone().negate(), backPoint);

    // Raycast onto BOTH planes, pick nearest valid hit
    raycaster.current.setFromCamera(mouseNDC.current, camera);
    const ray = raycaster.current.ray;

    const hitGround = new THREE.Vector3();
    const hitBack = new THREE.Vector3();
    const gotGround = ray.intersectPlane(groundPlane.current, hitGround);
    const gotBack = ray.intersectPlane(backPlane.current, hitBack);

    if (gotGround && gotBack) {
      // Pick the one closer to the camera
      const dG = hitGround.distanceToSquared(ray.origin);
      const dB = hitBack.distanceToSquared(ray.origin);
      v.target.copy(dG < dB ? hitGround : hitBack);
    } else if (gotGround) {
      v.target.copy(hitGround);
    } else if (gotBack) {
      v.target.copy(hitBack);
    } else {
      return; // No valid hit
    }

    // ── Rest mode: cursor too low OR mouse left viewport ────────────────────
    const belowThreshold = mouseNDC.current.y < REST_THRESHOLD_Y;
    const shouldRest = isMouseGone.current || belowThreshold;
    if (shouldRest !== isRestMode.current) {
      isRestMode.current = shouldRest;
      if (containerRef.current) {
        containerRef.current.style.cursor = shouldRest ? "auto" : "none";
      }
      if (crosshairRef.current) {
        crosshairRef.current.style.opacity = "0";
      }
    }

    const isIdle = isRestMode.current || isInactive.current;

    // Capture EE position the moment idle starts
    if (isIdle && !wasIdle.current) {
      ee.getWorldPosition(frozenEEPos.current);
      idleTime.current = 0;
    }
    wasIdle.current = isIdle;

    // Wrist spin during any idle state (before IK so solver keeps EE fixed)
    // idleBlend ramps 0→1 on entry, 1→0 on exit for a smooth start/stop
    // When mouse left viewport: lerp back to default. When inactive: use frozen EE pos.
    if (isRestMode.current) {
      smoothTarget.current.lerp(DEFAULT_TARGET, 0.03);
    }

    // ── Idle blend ramp ───────────────────────────────────────────────────
    if (isIdle) {
      idleBlend.current = Math.min(idleBlend.current + IDLE_BLEND_SPEED * delta, 1);
      idleTime.current += delta;
    } else {
      idleBlend.current = Math.max(idleBlend.current - IDLE_BLEND_SPEED * delta, 0);
    }

    // (no working-volume clamp — let the arm reach its full extent toward the camera)

    // ── Clamp target backward (away from camera) ────────────────────────────
    const maxBackDistance = 0.5;
    const backDist = v.basePos.z - v.target.z;
    if (backDist > maxBackDistance) {
      v.target.z = v.basePos.z - maxBackDistance;
    }

    // ── Smooth the IK target (lag behind cursor) ────────────────────────────
    if (!smoothInitialized.current) {
      smoothTarget.current.copy(v.target);
      smoothInitialized.current = true;
    }
    if (!isRestMode.current) {
      smoothTarget.current.lerp(v.target, TARGET_SMOOTH);
      // Clamp so the IK target never goes below the ground plane
      smoothTarget.current.y = Math.max(smoothTarget.current.y, 0);
    }
    // During idle: use frozen EE world pos as IK target so crosshair never moves
    const ikTarget = isInactive.current ? frozenEEPos.current : smoothTarget.current;

    // Lift the IK target slightly while the smooth target is still catching up.
    // Applied to a separate vector so smoothTarget stays clean and comes back down naturally.
    const lag = smoothTarget.current.distanceTo(v.target);
    const lift = Math.min(lag * 0.3, 0.06);
    const liftedIkTarget = lift > 0.001 && !isInactive.current
      ? ikTarget.clone().setY(ikTarget.y + lift)
      : ikTarget;

    // ── PHASE 1: Full CCD solve to get goal angles ──────────────────────────
    // Save current rotations
    const allJoints = [base, ...armJoints];
    const savedAngles: number[] = allJoints.map((j) => {
      const cfg = boneConfigRef.current.get(j);
      return cfg ? j.rotation[cfg.axis] : 0;
    });

    // Solve base first
    const baseConfig = boneConfigRef.current.get(base);
    if (base.parent && baseConfig) {
      const localTarget = base.parent.worldToLocal(liftedIkTarget.clone());
      const desired = Math.atan2(
        localTarget.x - base.position.x,
        localTarget.z - base.position.z
      );
      base.rotation[baseConfig.axis] = THREE.MathUtils.clamp(desired, baseConfig.min, baseConfig.max);
      // Idle: nudge base slightly off-axis AFTER atan2 so CCD arm compensates
      // EE world position is unaffected — CCD redistributes the offset to arm joints
      if (idleBlend.current > 0) {
        base.rotation[baseConfig.axis] += Math.sin(idleTime.current * 0.28) * IDLE_BASE_AMP * idleBlend.current;
      }
      base.updateWorldMatrix(true, true);
    }

    // Full CCD (8 iterations for convergence)
    for (let iter = 0; iter < 8; iter++) {
      for (let i = armJoints.length - 1; i >= 0; i--) {
        const joint = armJoints[i];
        const config = boneConfigRef.current.get(joint);
        if (!config) continue;

        ee.getWorldPosition(v.eePos);
        joint.getWorldPosition(v.jointPos);
        v.toEE.copy(v.eePos).sub(v.jointPos);
        v.toTarget.copy(liftedIkTarget).sub(v.jointPos);

        if (v.toEE.lengthSq() < 1e-8 || v.toTarget.lengthSq() < 1e-8) continue;

        const axisLocal = new THREE.Vector3(
          config.axis === "x" ? 1 : 0,
          config.axis === "y" ? 1 : 0,
          config.axis === "z" ? 1 : 0
        );
        const worldQuat = joint.getWorldQuaternion(new THREE.Quaternion());
        const axisWorld = axisLocal.applyQuaternion(worldQuat).normalize();

        const eeProj = v.toEE.clone().projectOnPlane(axisWorld);
        const targetProj = v.toTarget.clone().projectOnPlane(axisWorld);
        if (eeProj.lengthSq() < 1e-8 || targetProj.lengthSq() < 1e-8) continue;
        eeProj.normalize();
        targetProj.normalize();

        let angle = Math.acos(THREE.MathUtils.clamp(eeProj.dot(targetProj), -1, 1));
        const cross = eeProj.clone().cross(targetProj);
        if (cross.dot(axisWorld) < 0) angle = -angle;

        const newAngle = joint.rotation[config.axis] + angle;
        joint.rotation[config.axis] = THREE.MathUtils.clamp(newAngle, config.min, config.max);
        joint.updateWorldMatrix(true, true);
      }
    }

    // Read goal angles
    const goalAngles: number[] = allJoints.map((j) => {
      const cfg = boneConfigRef.current.get(j);
      return cfg ? j.rotation[cfg.axis] : 0;
    });

    // ── PHASE 2: Restore saved angles and lerp toward goals ─────────────────
    allJoints.forEach((joint, idx) => {
      const cfg = boneConfigRef.current.get(joint);
      if (!cfg) return;

      // During idle: use faster lerp so joints snap to compensate wrist spin quickly
      const speed = isInactive.current
        ? Math.min((BONE_FOLLOW[joint.name] ?? 0.06) * 4, 1)
        : (BONE_FOLLOW[joint.name] ?? 0.06);
      const current = savedAngles[idx];
      let goal = goalAngles[idx];

      let diff = goal - current;
      diff = ((diff + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      goal = current + diff;

      const lerped = THREE.MathUtils.lerp(current, goal, speed);
      joint.rotation[cfg.axis] = THREE.MathUtils.clamp(lerped, cfg.min, cfg.max);
    });

    // Rebuild matrices after setting final angles
    base.updateWorldMatrix(true, true);

    // ── Export end-effector position for the ball magnet ─────────────────────
    ee.getWorldPosition(eeWorldPos.current);
    baseWorldPos.current.copy(v.basePos);

    // ── Crosshair: frozen during idle so it never drifts ──────────────────
    if (crosshairRef.current) {
      const projPos = isInactive.current ? frozenEEPos.current : eeWorldPos.current;
      const proj = projPos.clone().project(camera);
      const x = (proj.x + 1) / 2 * size.width;
      const y = (-proj.y + 1) / 2 * size.height;
      crosshairRef.current.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
      crosshairRef.current.style.opacity = proj.z < 1 ? "1" : "0";
    }
  });

  return (
    <>
      <Environment preset="studio" environmentIntensity={0.6} />
      <ambientLight intensity={0.01} color="#ffffff" />
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

const MAX_BALLS = 6;

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

  useFrame(({ camera }, delta) => {
    const rb = rigidRef.current;
    if (!rb) return;

    // ── Sinking animation: ball fell into hole ───────────────────────────
    if (sinking.current) {
      const { hx, hz } = sinking.current;
      const cur = rb.translation();
      const newY = cur.y - delta * 1.8;
      rb.setNextKinematicTranslation({ x: hx, y: newY, z: hz });
      if (newY < -0.25 && !scoreFired.current) {
        scoreFired.current = true;
        onScored();
      }
      return;
    }

    const pos = rb.translation();
    const ballPos = new THREE.Vector3(pos.x, pos.y, pos.z);

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
}: {
  eeWorldPos: React.RefObject<THREE.Vector3>;
  mouseDown: React.RefObject<boolean>;
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
      return next.length > MAX_BALLS ? next.slice(next.length - MAX_BALLS) : next;
    });
    setActiveId(newId);
  }, []);

  const handleOffscreen = useCallback((id: number) => {
    const newId = Date.now() + Math.random();
    setBalls(prev => {
      const without = prev.filter(b => b !== id);
      const next = [...without, newId];
      return next.length > MAX_BALLS ? next.slice(next.length - MAX_BALLS) : next;
    });
    setActiveId(newId);
  }, []);

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
  const eeWorldPos = useRef(new THREE.Vector3());
  const baseWorldPos = useRef(new THREE.Vector3());
  const mouseDown = useRef(false);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
        camera={{ position: [4, 3, 5], fov: 45, near: 0.1, far: 500 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: .8,
          localClippingEnabled: true,
        }}
        shadows
      >
        <Physics gravity={[0, -9.81, 0]}>
          <RobotScene eeWorldPos={eeWorldPos} baseWorldPos={baseWorldPos} crosshairRef={crosshairRef} containerRef={containerRef} />
          {/* Grid floor */}
          <gridHelper args={[10, 10, "#BBBBBB", "#DDDDDD"]} position={[0, 0, 0]} />
          {/* Ground collider – cut at back edge so balls roll off */}
          <CuboidCollider args={[5, 0.5, 2]} position={[0, -0.5, 1.5]} />
          <BallSpawner
            eeWorldPos={eeWorldPos}
            mouseDown={mouseDown}
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
    </div>
  );
}

useGLTF.preload("/robot2.glb");

