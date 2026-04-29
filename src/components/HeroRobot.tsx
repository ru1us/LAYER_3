import { useGLTF, Environment } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import { Physics, RigidBody, RapierRigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { BallModel } from "./BallModel";


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

function RobotScene({ eeWorldPos, baseWorldPos }: { eeWorldPos: React.RefObject<THREE.Vector3>; baseWorldPos: React.RefObject<THREE.Vector3> }) {
  const gltf = useGLTF("/robot2.glb");
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

    base.getWorldPosition(v.basePos);
    groundY.current = v.basePos.y;
    // Ground plane raised by ball radius so grabbed ball sits on the surface
    groundPlane.current.set(new THREE.Vector3(0, 1, 0), -BALL_RADIUS);
    // Back plane: camera-facing, 30cm behind the robot
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const backPoint = v.basePos.clone().addScaledVector(camDir, 0.3);
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

function randomSkySpawn(): [number, number, number] {
  const x = (Math.random() - 0.5) * SPAWN_RANGE_X * 2;
  const y = 2.5 + Math.random() * 0.5;
  const z = (Math.random() - 0.5) * SPAWN_RANGE_Z * 2;
  return [x, y, z];
}

const MAX_BALLS = 6;

function InteractiveBall({
  eeWorldPos,
  mouseDown,
  isActive,
  onOffscreen,
}: {
  eeWorldPos: React.RefObject<THREE.Vector3>;
  mouseDown: React.RefObject<boolean>;
  isActive: boolean;
  onOffscreen: () => void;
}) {
  const rigidRef = useRef<RapierRigidBody>(null);
  const wasHeld = useRef(false);
  const isHeld = useRef(false);
  const prevEEPos = useRef(new THREE.Vector3());
  const initPos = useRef<[number, number, number]>(randomSkySpawn());
  const spawnTime = useRef(performance.now());
  const offscreenFired = useRef(false);

  useFrame(({ camera }) => {
    const rb = rigidRef.current;
    if (!rb) return;

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

  const handleOffscreen = useCallback((id: number) => {
    const newId = Date.now() + Math.random();
    setBalls(prev => {
      const without = prev.filter(b => b !== id);
      const next = [...without, newId];
      return next.length > MAX_BALLS ? next.slice(next.length - MAX_BALLS) : next;
    });
    setActiveId(newId);
  }, []);

  return (
    <>
      {balls.map(id => (
        <InteractiveBall
          key={id}
          isActive={id === activeId}
          onOffscreen={() => handleOffscreen(id)}
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
          toneMappingExposure: .8,
        }}
        shadows
      >
        <Physics gravity={[0, -9.81, 0]}>
          <RobotScene eeWorldPos={eeWorldPos} baseWorldPos={baseWorldPos} />
          {/* Grid floor */}
          <gridHelper args={[10, 10, "#888888", "#d0d0d0"]} position={[0, 0, 0]} />
          {/* Ground collider – cut at back edge so balls roll off */}
          <CuboidCollider args={[5, 0.5, 2]} position={[0, -0.5, 1.5]} />
          <BallSpawner
            eeWorldPos={eeWorldPos}
            mouseDown={mouseDown}
          />
        </Physics>
      </Canvas>
    </div>
  );
}

useGLTF.preload("/robot2.glb");

