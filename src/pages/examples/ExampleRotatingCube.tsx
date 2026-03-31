import { Suspense, useRef, useCallback, useEffect, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, MeshTransmissionMaterial, Environment, useGLTF } from "@react-three/drei";
import { Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { Link } from "react-router-dom";
import * as THREE from "three";

const BOUNDS = 3.5;
const PUSH_STRENGTH = 8;

const Z_SPRING = 4;

function CustomShape() {
    const gltf = useGLTF("/L.glb");
    const mesh = gltf.scene.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh;
    if (!mesh?.geometry) return <boxGeometry args={[1, 1, 1]} />;
    
    const geom = mesh.geometry.clone();
    geom.scale(0.3, 0.3, 0.3);
    return <primitive object={geom} attach="geometry" />;
}

function useBoundaryForce(rigidRef: RefObject<RapierRigidBody | null>, startZ = 0) {
    useFrame(() => {
        const body = rigidRef.current;
        if (!body) return;
        const pos = body.translation();
        let fx = 0, fy = 0, fz = 0;
        if (pos.x > BOUNDS) fx = -PUSH_STRENGTH;
        if (pos.x < -BOUNDS) fx = PUSH_STRENGTH;
        if (pos.y > BOUNDS) fy = -PUSH_STRENGTH;
        if (pos.y < -BOUNDS) fy = PUSH_STRENGTH;
        if (pos.z > BOUNDS) fz = -PUSH_STRENGTH;
        if (pos.z < -BOUNDS) fz = PUSH_STRENGTH;
        // Spring force pulling cube back to its start Z
        const zDiff = startZ - pos.z;
        fz += zDiff * Z_SPRING;
        if (fx || fy || fz) {
            body.applyImpulse({ x: fx * 0.016, y: fy * 0.016, z: fz * 0.016 }, true);
        }
    });
}

function GlassCube({ position = [0, 0, 0], shape = "cube" }: { position?: [number, number, number]; shape?: "cube" | "sphere" | "custom" }) {
    const rigidRef = useRef<RapierRigidBody>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const isDragging = useRef(false);
    const dragPlane = useRef(new THREE.Plane());
    const dragOffset = useRef(new THREE.Vector3());
    const prevWorldPos = useRef(new THREE.Vector3());
    const velocity = useRef(new THREE.Vector3());
    const { camera, raycaster } = useThree();

    useBoundaryForce(rigidRef, position[2]);

    useFrame(() => {
        if (!rigidRef.current || isDragging.current) return;
        const vel = rigidRef.current.linvel();
        const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
        if (speed < 0.3) {
            rigidRef.current.applyTorqueImpulse(
                { x: 0.0003, y: 0.0005, z: 0.0001 },
                true,
            );
        }
    });

    const planeIntersect = useCallback(
        (pointer: THREE.Vector2) => {
            raycaster.setFromCamera(pointer, camera);
            const hit = new THREE.Vector3();
            raycaster.ray.intersectPlane(dragPlane.current, hit);
            return hit;
        },
        [camera, raycaster],
    );

    const onPointerDown = useCallback(
        (e: THREE.Event & { point: THREE.Vector3; pointer: THREE.Vector2; stopPropagation: () => void }) => {
            e.stopPropagation();
            isDragging.current = true;
            const body = rigidRef.current;
            if (!body) return;

            const bodyPos = body.translation();
            const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            dragPlane.current.setFromNormalAndCoplanarPoint(camDir, new THREE.Vector3(bodyPos.x, bodyPos.y, bodyPos.z));

            const hitWorld = planeIntersect(e.pointer);
            if (hitWorld) {
                dragOffset.current.set(bodyPos.x - hitWorld.x, bodyPos.y - hitWorld.y, bodyPos.z - hitWorld.z);
            }
            prevWorldPos.current.set(bodyPos.x, bodyPos.y, bodyPos.z);
            velocity.current.set(0, 0, 0);

            body.setLinvel({ x: 0, y: 0, z: 0 }, true);
            body.setAngvel({ x: 0, y: 0, z: 0 }, true);
            body.setGravityScale(0, true);
            body.setBodyType(2, true); // kinematic

            (e as unknown as { target: HTMLElement }).target?.setPointerCapture?.(
                (e as unknown as PointerEvent).pointerId,
            );
        },
        [camera, planeIntersect],
    );

    const onPointerMove = useCallback(
        (e: THREE.Event & { pointer: THREE.Vector2; stopPropagation: () => void }) => {
            if (!isDragging.current || !rigidRef.current) return;
            e.stopPropagation();
            const hit = planeIntersect(e.pointer);
            if (!hit) return;

            const target = hit.add(dragOffset.current);
            const prev = prevWorldPos.current;
            velocity.current.set(
                (target.x - prev.x) * 60,
                (target.y - prev.y) * 60,
                (target.z - prev.z) * 60,
            );
            prevWorldPos.current.copy(target);

            rigidRef.current.setNextKinematicTranslation(
                { x: target.x, y: target.y, z: target.z },
            );
        },
        [planeIntersect],
    );

    const onPointerUp = useCallback(() => {
        if (!isDragging.current || !rigidRef.current) return;
        isDragging.current = false;
        rigidRef.current.setBodyType(0, true);
        rigidRef.current.setGravityScale(0, true);
        const v = velocity.current;
        rigidRef.current.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
        rigidRef.current.applyTorqueImpulse(
            { x: v.y * 0.01, y: -v.x * 0.01, z: 0 },
            true,
        );
    }, []);

    return (
        <RigidBody
            ref={rigidRef}
            colliders="trimesh"
            position={position}
            linearDamping={1.2}
            angularDamping={0.8}
            gravityScale={0}
            restitution={0.8}
            friction={0.2}
            canSleep={false}
        >
            <mesh
                ref={meshRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
            >
                {shape === "sphere" ? (
                    <sphereGeometry args={[0.6, 32, 32]} />
                ) : shape === "custom" ? (
                    <CustomShape />
                ) : (
                    <boxGeometry args={[1.2, 1.2, 1.2]} />
                )}
                <MeshTransmissionMaterial
                    backside
                    backsideThickness={0.3}
                    samples={6}
                    transmission={0.97}
                    thickness={0.5}
                    chromaticAberration={0.2}
                    anisotropy={0.1}
                    distortion={0.08}
                    distortionScale={0.15}
                    temporalDistortion={0.05}
                    roughness={0.2}
                    ior={1.5}
                    color="#ffffff"
                />
            </mesh>
        </RigidBody>
    );
}

/* ── Camera parallax ─────────────────────────── */
function CameraRig() {
    const { camera } = useThree();
    const mouse = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
        };
        window.addEventListener("mousemove", handler);
        return () => window.removeEventListener("mousemove", handler);
    }, []);

    useFrame(() => {
        camera.position.x += (-mouse.current.x * 0.2 - camera.position.x) * 0.05;
        camera.position.y += (-mouse.current.y * 0.15 - camera.position.y) * 0.05;
        camera.lookAt(0, 0, 0);
    });

    return null;
}

/* ── Background text ────────────────────────── */
function BackgroundText() {
    return (
        <Text
            position={[0, 0, -3]}
            fontSize={2.5}
            fontWeight="bold"
            letterSpacing={0.15}
            color="#e7e7e7"
            anchorX="center"
            anchorY="middle"
        >
            LAYER_3
        </Text>
    );
}

/* ── Scene content ──────────────────────────── */
function SceneContent() {
    return (
        <>
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <directionalLight position={[-3, -1, -3]} intensity={0.3} />
            <color attach="background" args={["#000000"]} />
            {/* <Environment preset="city" blur={1}/> */}
            <CameraRig />
            <BackgroundText />
            <Physics gravity={[0, 0, 0]}>
                <GlassCube position={[-2.5, 0, 0]} shape="cube" />
                <GlassCube position={[2.5, 0, 0]} shape="custom" />
            </Physics>
        </>
    );
}

/* ── Page ────────────────────────────────────── */
export default function ExampleRotatingCube() {
    return (
        <div className="mx-auto w-full px-8 py-8">
            {/* Breadcrumb */}
            <nav className="mb-2 text-xs tracking-wide text-text-muted">
                <Link to="/" className="hover:text-text">
                    Home
                </Link>
                <span className="mx-2 opacity-30">/</span>
                <span className="text-text">Glass Cube</span>
            </nav>

            {/* 3D Canvas */}
            <div className="h-[80vh] w-full overflow-hidden rounded-lg border border-border backdrop-blur-sm" style={{ background: "transparent" }}>
                <Canvas camera={{ position: [0, 0, 5], fov: 45 }} style={{ cursor: "grab" }}>
                    <Suspense fallback={null}>
                        <SceneContent />
                    </Suspense>
                </Canvas>
            </div>
            <div className="mx-auto max-w-6xl">
            <p className="mt-4 mb-12 text-center text-xs text-text-muted">
                Grab the cube and throw it &middot; It refracts the text behind it &middot; Boundary forces keep it in view
            </p>

            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-text-muted">
                Beginner
            </p>
            <h1 className="mb-4 text-3xl font-light tracking-tight">Glass Cube</h1>
            <p className="mb-10 max-w-lg text-sm leading-relaxed text-text-muted">
                A glass cube with transmission, refraction and chromatic aberration.
                Physics lets you grab and throw it. Boundary forces push it back into view.
                The text behind it distorts through the glass.
            </p>

            {/* Tools table */}
            <section className="mb-12">
                <h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-text-muted">
                    Tools used
                </h2>
                <div className="glass overflow-hidden rounded-lg">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="px-4 py-3 text-left font-medium text-text-muted">Tool</th>
                                <th className="px-4 py-3 text-left font-medium text-text-muted">Package</th>
                                <th className="px-4 py-3 text-left font-medium text-text-muted">Purpose</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {[
                                ["MeshTransmissionMaterial", "@react-three/drei", "Glass with refraction and noise"],
                                ["RigidBody", "@react-three/rapier", "Physics body for the cube"],
                                ["Text", "@react-three/drei", "3D text in the scene"],
                                ["Environment", "@react-three/drei", "HDR environment for reflections"],
                                ["useFrame", "@react-three/fiber", "Per-frame boundary force check"],
                                ["raycaster", "Three.js", "Pointer-to-3D plane intersection"],
                            ].map(([tool, pkg, purpose]) => (
                                <tr key={tool} className="hover:bg-glass-hover">
                                    <td className="px-4 py-3">
                                        <code className="rounded border border-border bg-bg px-1.5 py-0.5 text-[11px] text-accent">
                                            {tool}
                                        </code>
                                    </td>
                                    <td className="px-4 py-3 text-text-muted">{pkg}</td>
                                    <td className="px-4 py-3 text-text-muted">{purpose}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="pb-10">
                <Link to="/" className="text-xs text-text-muted hover:text-text transition-colors">
                    &larr; Back to overview
                </Link>
            </div>
            </div>
        </div>
    );
}
