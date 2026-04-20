import { useGLTF, Environment } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Physics, RigidBody, RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { BallModel } from "./BallModel";

// ── Kinematic chain from GLB ─────────────────────────────────────────────────
// Armature → Bone (base) → Bone.001 → Bone.002 → Bone.003 → Bone.004 → Bone.005
// All bones are stacked vertically (Y translations).
//
// Bone       = base turntable (Y-rotation swivel)
// Bone.001–Bone.004 = arm pitch joints (CCD IK)
// Bone.005   = end-effector tip

interface BoneConfig {
  axis: "x" | "y" | "z";
  min: number; // angle limit in radians
  max: number; // angle limit in radians
}

// ── Configure each bone: axis of rotation + angle limits ──────────────────
// Bone names are sanitized by Three.js (Bone.001 → Bone001, Bone.005 → Bone005)
// Adjust per your rigged Blender bones!
//
// Example: { axis: "z", min: -Math.PI/2, max: Math.PI/2 }
// Use ±Infinity for no limits
// Per-bone follow speed (0–1). Base slowest → tip fastest = natural motion.
const BONE_FOLLOW: Record<string, number> = {
  "Bone":    0.035,
  "Bone001": 0.045,
  "Bone002": 0.055,
  "Bone003": 0.065,
  "Bone004": 0.075,
  "Bone005": 0.085,
  "Bone006": 0.095, 
};

// How fast the IK target itself smooths toward the cursor (0–1)
const TARGET_SMOOTH = 0.08;

const BONE_CONFIG: Record<string, BoneConfig> = {
  // Base turntable
  "Bone": { axis: "y", min: -Infinity, max: Infinity },

  // Arm pitch joints (edit these to limit each joint)
  "Bone001": { axis: "x", min: -Math.PI/2, max: Math.PI/2 },
  "Bone002": { axis: "y", min: -Math.PI/4, max: Math.PI/4 },
  "Bone003": { axis: "x", min: 0, max: Math.PI/1.2 },
  "Bone004": { axis: "y", min: -Math.PI/4, max: Math.PI/4 },
  "Bone005": { axis: "x", min: -Math.PI/4, max: Math.PI /4},
  "Bone006": { axis: "y", min: -Math.PI/2, max: Math.PI/2 },
  
  // End-effector empty (no rotation, just position target)
  "endeffector": { axis: "z", min: -Infinity, max: Infinity },
};

function RobotScene({ eeWorldPos, baseWorldPos }: { eeWorldPos: React.MutableRefObject<THREE.Vector3>; baseWorldPos: React.MutableRefObject<THREE.Vector3> }) {
  const gltf = useGLTF("robot2.glb");
  const { scene, camera } = useThree();
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
    scene.background = new THREE.Color("#f0ede8");
    scene.fog = new THREE.Fog("#f0ede8", 30, 60);

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
    textureLoader.load("metalroughness.png", (roughnessTexture) => {
      roughnessTexture.colorSpace = THREE.SRGBColorSpace;
      gltf.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat) => {
            if ("roughness" in mat) {
              (mat as any).roughnessMap = roughnessTexture;
              mat.needsUpdate = true;
            }
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

    // ── Find joints by walking the bone chain ────────────────────────────────
    // Three.js GLTFLoader sanitizes names (Bone.005 → Bone_005 etc.)
    // So instead of name lookup, find the base "Bone" node and walk children.
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
    const onMove = (e: MouseEvent) => {
      mouseNDC.current.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1)
      );
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
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
  const smoothTarget = useRef(new THREE.Vector3());
  const smoothInitialized = useRef(false);

  // ── Two planes for cursor projection ──────────────────────────────────────
  // 1. Ground plane (horizontal, Y-up) at robot base height
  // 2. Back plane (camera-facing, vertical) just behind the robot
  // We test BOTH and pick the closest valid hit.
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const backPlane = useRef(new THREE.Plane());
  const groundY = useRef(0);

  useFrame(() => {
    const base = baseRef.current;
    const armJoints = armJointsRef.current;
    const ee = endEffectorRef.current;
    if (!base || armJoints.length === 0 || !ee) return;

    const v = _v.current;

    // ── Setup both planes ──────────────────────────────────────────────────
    base.getWorldPosition(v.basePos);
    groundY.current = v.basePos.y;
    // Ground plane at Y=0 (actual floor level)
    groundPlane.current.set(new THREE.Vector3(0, 1, 0), 0);
    // Back plane: camera-facing, 30cm behind the robot
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const backPoint = v.basePos.clone().addScaledVector(camDir, 0.3);
    backPlane.current.setFromNormalAndCoplanarPoint(camDir.clone().negate(), backPoint);

    // ── Raycast onto BOTH planes, pick nearest valid hit ────────────────────
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

    // ── Clamp target to stay close behind the base (working volume) ─────────
    const maxBackDistance = 0.5;
    const backDist = v.target.z - v.basePos.z;
    if (backDist > maxBackDistance) {
      v.target.z = v.basePos.z + maxBackDistance;
    }

    // ── Smooth the IK target (lag behind cursor) ────────────────────────────
    if (!smoothInitialized.current) {
      smoothTarget.current.copy(v.target);
      smoothInitialized.current = true;
    }
    smoothTarget.current.lerp(v.target, TARGET_SMOOTH);
    const ikTarget = smoothTarget.current;

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
      const localTarget = base.parent.worldToLocal(ikTarget.clone());
      const desired = Math.atan2(
        localTarget.x - base.position.x,
        localTarget.z - base.position.z
      );
      base.rotation[baseConfig.axis] = THREE.MathUtils.clamp(desired, baseConfig.min, baseConfig.max);
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
        v.toTarget.copy(ikTarget).sub(v.jointPos);

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

      const speed = BONE_FOLLOW[joint.name] ?? 0.06;
      const current = savedAngles[idx];
      let goal = goalAngles[idx];

      // Wrap difference to [-PI, PI] for shortest-path interpolation
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
  });

  return (
    <>
      <Environment preset="studio" />
      <ambientLight intensity={0.3} color="#ffffff" />
      <primitive object={gltf.scene} />
    </>
  );
}

// ── Interactive Ball with rigid body ─────────────────────────────────────────
const BALL_RADIUS = 0.04;
const BALL_START: [number, number, number] = [0.15, 0.6, 0.15];
const ARM_REACH = 0.8; // max distance from base before ball is pushed back
const MAGNET_RANGE = 0.2; // distance within which cursor "aims" at the ball

function InteractiveBall({
  eeWorldPos,
  mouseDown,
  baseWorldPos,
}: {
  eeWorldPos: React.MutableRefObject<THREE.Vector3>;
  mouseDown: React.MutableRefObject<boolean>;
  baseWorldPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const rigidRef = useRef<RapierRigidBody>(null);
  const wasHeld = useRef(false);
  const prevEEPos = useRef(new THREE.Vector3());

  useFrame(() => {
    const rb = rigidRef.current;
    if (!rb) return;

    const pos = rb.translation();
    const ballPos = new THREE.Vector3(pos.x, pos.y, pos.z);

    // ── Out-of-bounds: push ball back toward base ─────────────────────────
    const base = baseWorldPos.current;
    const distFromBase = ballPos.distanceTo(base);
    if (distFromBase > ARM_REACH) {
      const pushDir = base.clone().sub(ballPos).normalize().multiplyScalar(3);
      rb.applyImpulse({ x: pushDir.x, y: 0.5, z: pushDir.z }, true);
    }

    // ── Keep ball above ground ──────────────────────────────────────────────
    if (pos.y < BALL_RADIUS) {
      rb.setTranslation({ x: pos.x, y: BALL_RADIUS, z: pos.z }, true);
    }

    // ── Magnet: if mouse held and EE close to ball, snap ball to EE ─────────
    if (mouseDown.current) {
      const eePos = eeWorldPos.current;
      const distToEE = ballPos.distanceTo(eePos);
      if (distToEE < MAGNET_RANGE) {
        // Snap ball directly to EE without interpolation
        rb.setTranslation({ x: eePos.x, y: eePos.y, z: eePos.z }, true);
        // Zero velocity while held to prevent gravity interference
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        // Update EE position for next frame's velocity calculation
        prevEEPos.current.copy(eePos);
      }
    }

    // ── Drop ball on release: restore velocity based on EE motion ─────────
    if (wasHeld.current && !mouseDown.current) {
      const eePos = eeWorldPos.current;
      const eeVelocity = eePos.clone().sub(prevEEPos.current).multiplyScalar(60); // 60 FPS estimate
      rb.setLinvel({ x: eeVelocity.x, y: eeVelocity.y, z: eeVelocity.z }, true);
    }
    wasHeld.current = mouseDown.current;
  });

  return (
    <RigidBody
      ref={rigidRef}
      position={BALL_START}
      colliders="ball"
      restitution={0.6}
      friction={0.8}
      linearDamping={1.5}
      angularDamping={1.0}
      mass={0.1}
    >
      <BallModel />
    </RigidBody>
  );
}

export default function HeroWind() {
  const eeWorldPos = useRef(new THREE.Vector3());
  const baseWorldPos = useRef(new THREE.Vector3());
  const mouseDown = useRef(false);

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
    <div style={{ width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [4, 3, 5], fov: 45, near: 0.1, far: 500 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        shadows
      >
        <Physics gravity={[0, -9.81, 0]}>
          <RobotScene eeWorldPos={eeWorldPos} baseWorldPos={baseWorldPos} />
          {/* Grid floor */}
          <gridHelper args={[10, 10, "#888888", "#d0d0d0"]} position={[0, 0.001, 0]} />
          {/* Invisible ground collider */}
          <RigidBody type="fixed" position={[0, 0, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[10, 10]} />
              <meshStandardMaterial transparent opacity={0} />
            </mesh>
          </RigidBody>
          <InteractiveBall
            eeWorldPos={eeWorldPos}
            mouseDown={mouseDown}
            baseWorldPos={baseWorldPos}
          />
        </Physics>
      </Canvas>
    </div>
  );
}

useGLTF.preload("robot2.glb");

