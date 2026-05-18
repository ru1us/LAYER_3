import { Suspense } from "react";
import { Link } from "react-router-dom";
import HeroRobot from "../../components/HeroRobot.tsx";

const GH = "https://github.com/ru1us/LAYER_3";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="font-mono text-[0.68rem] leading-relaxed bg-[#111] text-[#e8ff00] p-5 overflow-x-auto border border-[#333]">
      {children.trim()}
    </pre>
  );
}

function FolderBox({ tag, title, children }: { tag: string; title: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="flex items-end">
        <div className="border border-b-0 border-border bg-surface flex items-center gap-3 px-5 py-2 shrink-0">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted">{tag}</span>
          <span className="font-doto text-sm text-text">{title}</span>
        </div>
        <div className="flex-1 border-t border-border" />
      </div>
      <div className="p-10">{children}</div>
    </div>
  );
}

export default function CCDPage() {
  return (
    <div className="bg-surface min-h-screen">
      {/* Header */}
      <div className="mx-auto max-w-5xl px-12 pt-16 pb-10">
        <Link
          to="/"
          className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text-muted hover:text-text transition-colors"
        >
          ← Back
        </Link>
        <div className="mt-8">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-3">
            Algorithm 01 · Three.js Implementation
          </p>
          <h1 className="font-doto text-5xl mb-4">CCD_IK</h1>
          <p className="font-mono text-[0.78rem] leading-relaxed text-text-muted max-w-2xl">
            A walkthrough of how the robot arm is built in Three.js and React Three Fiber —
            scene setup, model loading, pointer-to-world mapping, and the frame loop.
          </p>
          <a
            href={GH}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 mt-5 border border-border px-4 py-2 hover:bg-[#f0f0f0] transition-colors"
          >
            <img src="/GitHub_Logo.svg" alt="GitHub" className="h-4 w-auto" />
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em]">ru1us/LAYER_3</span>
          </a>
        </div>
      </div>

      {/* Sim */}
      <div className="relative h-screen">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center bg-bg">
              <div className="font-mono text-[0.7rem] uppercase tracking-caps text-text-muted">Loading...</div>
            </div>
          }
        >
          <HeroRobot />
        </Suspense>
      </div>

      <div className="mx-auto max-w-5xl px-12 py-12 space-y-10">
        <FolderBox tag="Step 01" title="CANVAS_SETUP">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Three.js</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                The scene lives inside a React Three Fiber <span className="text-text">{"<Canvas>"}</span> that
                fills the viewport. A perspective camera sits at <span className="text-text">[0, 5, 8]</span> looking
                at the origin. <span className="text-text">{"<ambientLight>"}</span> provides soft fill;
                a <span className="text-text">{"<directionalLight>"}</span> casts shadows from above.
                An invisible full-screen <span className="text-text">{"<Plane>"}</span> mesh catches pointer
                events and forwards them to the IK target pipeline.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Code</p>
              <CodeBlock>{`
<Canvas camera={{ position: [0, 5, 8], fov: 45 }}>
  <ambientLight intensity={0.6} />
  <directionalLight
    position={[5, 10, 5]}
    intensity={1.2}
    castShadow
  />
  <RobotArm />
  {/* invisible hit plane for pointer events */}
  <Plane
    args={[20, 20]}
    rotation={[-Math.PI / 2, 0, 0]}
    visible={false}
    onPointerMove={onMove}
  />
</Canvas>
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        {/* Section 2 */}
        <FolderBox tag="Step 02" title="GLB_LOADER">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Three.js</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                The robot GLB is loaded with Drei's <span className="text-text">useGLTF</span> hook, which
                returns a pre-parsed Three.js scene graph. <span className="text-text">scene.traverse()</span> walks
                every node — bones are matched by name against <span className="text-text">BONE_CONFIG</span>,
                which stores the constrained rotation axis and angle limits per joint.
                All matched bone refs are stored in a <span className="text-text">useRef</span> map
                for per-frame access without triggering re-renders. Three.js strips dots from
                names at runtime, so <code className="text-text">Bone.001</code> becomes{" "}
                <code className="text-text">Bone001</code>.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Code</p>
              <CodeBlock>{`
const BONE_CONFIG = {
  "Bone":    { axis: "y", min: -Infinity, max: Infinity },
  "Bone001": { axis: "x", min: -PI/2, max: PI/2 },
  "Bone002": { axis: "y", min: -PI/2, max: PI/2 },
  // …
};

const { scene } = useGLTF("/robot.glb");
const bonesRef = useRef({});

scene.traverse((node) => {
  if (node.isBone && BONE_CONFIG[node.name]) {
    bonesRef.current[node.name] = node;
  }
});
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        {/* Section 3 */}
        <FolderBox tag="Step 03" title="POINTER_PLANE">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Three.js</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                Converting a 2D cursor position into a 3D world point requires a{" "}
                <span className="text-text">Raycaster</span>. The ray is tested against
                two <span className="text-text">Plane</span> objects each frame — a ground
                plane at Y=0 and a vertical back plane facing the camera. The intersection
                closer to the camera wins. The result is lerped by{" "}
                <span className="text-text">0.08</span> each frame to produce smooth lag.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Code</p>
              <CodeBlock>{`
raycaster.setFromCamera(mouseNDC, camera);
const gotGround = ray.intersectPlane(groundPlane, hitGround);
const gotBack   = ray.intersectPlane(backPlane,   hitBack);

const dG = hitGround.distanceToSquared(ray.origin);
const dB = hitBack.distanceToSquared(ray.origin);
v.target.copy(dG < dB ? hitGround : hitBack);

// Smooth IK target
smoothTarget.lerp(v.target, 0.08);
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        {/* Section 4 */}
        <FolderBox tag="Step 04" title="USE_FRAME">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Three.js</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                R3F's <span className="text-text">useFrame</span> fires after React's render phase
                and before the WebGL draw call. Inside it, the CCD solve runs 8 times on goal
                angle copies. Solved angles are never applied directly — they are lerped toward
                using per-joint follow speeds from{" "}
                <span className="text-text">BONE_FOLLOW</span>. The base responds at 0.035,
                the tip at 0.095, creating a whip-like follow-through.{" "}
                <span className="text-text">bone.updateWorldMatrix(true, false)</span> flushes
                the hierarchy between CCD iterations so each bone reads a fresh world position.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Code</p>
              <CodeBlock>{`
const BONE_FOLLOW = {
  "Bone":    0.035, // base – slowest
  "Bone001": 0.045,
  "Bone002": 0.055,
  "Bone003": 0.065,
  "Bone004": 0.075,
  "Bone005": 0.085,
  "Bone006": 0.095, // tip – fastest
};

useFrame(() => {
  // 1. run CCD on goal copy
  solveCCD(goalAngles, smoothTarget);
  // 2. lerp current bone rotations toward goal
  for (const [name, bone] of Object.entries(bones)) {
    const speed = BONE_FOLLOW[name];
    bone.rotation[axis] = lerp(
      bone.rotation[axis], goalAngles[name], speed
    );
    bone.updateWorldMatrix(true, false);
  }
});
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        {/* Footer */}
        <div className="border-t border-border pt-8 flex items-center justify-between">
          <Link
            to="/"
            className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text-muted hover:text-text transition-colors"
          >
            ← Back to overview
          </Link>
          <Link
            to="/pages/fabrik"
            className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text hover:text-text-muted transition-colors"
          >
            Algorithm 02 — FABRIK →
          </Link>
        </div>
      </div>
    </div>
  );
}
