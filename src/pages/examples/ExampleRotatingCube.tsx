import { Suspense, useRef, useCallback, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, MeshTransmissionMaterial, Environment } from "@react-three/drei";
import { Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { Link } from "react-router-dom";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import * as THREE from "three";

/* ── Boundary force ─────────────────────────── */
const BOUNDS = 3.5;
const PUSH_STRENGTH = 8;

function useBoundaryForce(rigidRef: RefObject<RapierRigidBody | null>) {
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
        if (fx || fy || fz) {
            body.applyImpulse({ x: fx * 0.016, y: fy * 0.016, z: fz * 0.016 }, true);
        }
    });
}

/* ── Draggable glass cube ───────────────────── */
function GlassCube() {
    const rigidRef = useRef<RapierRigidBody>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const isDragging = useRef(false);
    const dragPlane = useRef(new THREE.Plane());
    const dragOffset = useRef(new THREE.Vector3());
    const prevWorldPos = useRef(new THREE.Vector3());
    const velocity = useRef(new THREE.Vector3());
    const { camera, raycaster } = useThree();

    useBoundaryForce(rigidRef);

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

            // Create drag plane perpendicular to camera at the cube's current Z
            const bodyPos = body.translation();
            const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            dragPlane.current.setFromNormalAndCoplanarPoint(camDir, new THREE.Vector3(bodyPos.x, bodyPos.y, bodyPos.z));

            // Calculate offset between hit point and body center so cube doesn't snap
            const hitWorld = planeIntersect(e.pointer);
            if (hitWorld) {
                dragOffset.current.set(bodyPos.x - hitWorld.x, bodyPos.y - hitWorld.y, bodyPos.z - hitWorld.z);
            }
            prevWorldPos.current.set(bodyPos.x, bodyPos.y, bodyPos.z);
            velocity.current.set(0, 0, 0);

            body.setLinvel({ x: 0, y: 0, z: 0 }, true);
            body.setAngvel({ x: 0, y: 0, z: 0 }, true);
            body.setGravityScale(0, true);

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

            rigidRef.current.setTranslation(
                { x: target.x, y: target.y, z: target.z },
                true,
            );
        },
        [planeIntersect],
    );

    const onPointerUp = useCallback(() => {
        if (!isDragging.current || !rigidRef.current) return;
        isDragging.current = false;
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
            colliders="cuboid"
            position={[0, 0, 0]}
            linearDamping={1.2}
            angularDamping={0.8}
            gravityScale={0}
        >
            <mesh
                ref={meshRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
            >
                <boxGeometry args={[1.2, 1.2, 1.2]} />
                <MeshTransmissionMaterial
                    backside
                    backsideThickness={0.3}
                    samples={6}
                    thickness={0.5}
                    chromaticAberration={0.05}
                    anisotropy={0.1}
                    distortion={0.5}
                    distortionScale={0.3}
                    temporalDistortion={0.3}
                    roughness={0.0}
                    ior={1.5}
                    color="#ffffff"
                />
            </mesh>
        </RigidBody>
    );
}

/* ── Background text ────────────────────────── */
function BackgroundText() {
    return (
        <Text
            position={[0, 0, -3]}
            fontSize={2.5}
            letterSpacing={0.15}
            color="#444444"
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
            <color attach="background" args={["#050505"]} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <directionalLight position={[-3, -1, -3]} intensity={0.3} />
            <Environment preset="city" />
            <BackgroundText />
            <Physics gravity={[0, 0, 0]}>
                <GlassCube />
            </Physics>
        </>
    );
}

/* ── Code snippet ───────────────────────────── */
const codeSnippet = `import { Text, MeshTransmissionMaterial, Environment } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";

function GlassCube() {
  return (
    <RigidBody colliders="cuboid" gravityScale={0} linearDamping={1.2}>
      <mesh>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <MeshTransmissionMaterial
          backside
          thickness={0.5}
          chromaticAberration={0.15}
          distortion={0.4}
          transmission={0.98}
          roughness={0.05}
          ior={1.5}
        />
      </mesh>
    </RigidBody>
  );
}

function Scene() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
      <Environment preset="city" />
      <Text position={[0, 0, -3]} fontSize={2.5} color="#333">
        LAYER_3
      </Text>
      <Physics gravity={[0, 0, 0]}>
        <GlassCube />
      </Physics>
    </Canvas>
  );
}`;

/* ── Concept card ───────────────────────────── */
function ConceptCard({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="glass rounded-lg p-5">
            <h3 className="mb-2 text-sm font-medium text-text">{title}</h3>
            <div className="text-xs leading-relaxed text-text-muted [&_code]:rounded [&_code]:border [&_code]:border-border [&_code]:bg-bg [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px] [&_code]:text-accent">
                {children}
            </div>
        </div>
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
            <div className="glass h-[80vh] w-full overflow-hidden rounded-lg">
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

            {/* Code */}
            <section className="mb-12">
                <h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-text-muted">
                    Code
                </h2>
                <div className="glass overflow-hidden rounded-lg">
                    <SyntaxHighlighter
                        language="tsx"
                        style={oneDark}
                        customStyle={{
                            margin: 0,
                            borderRadius: 0,
                            fontSize: "0.8rem",
                            background: "rgba(0,0,0,0.4)",
                            border: "none",
                        }}
                    >
                        {codeSnippet}
                    </SyntaxHighlighter>
                </div>
            </section>

            {/* Concepts */}
            <section className="mb-12">
                <h2 className="mb-5 text-xs uppercase tracking-[0.2em] text-text-muted">
                    Concepts
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    <ConceptCard title="MeshTransmissionMaterial">
                        <p>
                            From <code>@react-three/drei</code>. Simulates glass with real light transmission,
                            refraction (<code>ior</code>), chromatic aberration and distortion noise.
                        </p>
                    </ConceptCard>

                    <ConceptCard title="Physics with Rapier">
                        <p>
                            <code>@react-three/rapier</code> adds a full physics engine.
                            Wrap objects in <code>&lt;RigidBody&gt;</code> to give them mass, velocity and collision.
                        </p>
                    </ConceptCard>

                    <ConceptCard title="Drag and Throw">
                        <p>
                            Track pointer movement on a camera-facing plane. On release, apply the
                            accumulated velocity as an impulse for a natural throw.
                        </p>
                    </ConceptCard>

                    <ConceptCard title="Boundary Forces">
                        <p>
                            Each frame, check if the cube exceeds the bounds. If so, apply an
                            impulse pushing it back — a soft invisible wall.
                        </p>
                    </ConceptCard>

                    <ConceptCard title="Environment Map">
                        <p>
                            <code>&lt;Environment&gt;</code> from drei provides an HDR environment map.
                            Glass needs something to reflect and refract to look convincing.
                        </p>
                    </ConceptCard>

                    <ConceptCard title="3D Text">
                        <p>
                            <code>&lt;Text&gt;</code> from drei (via troika) renders sharp text in the scene.
                            Placed behind the cube so it distorts through the glass.
                        </p>
                    </ConceptCard>
                </div>
            </section>

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
