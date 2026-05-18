import { Link } from "react-router-dom";

const GH = "https://github.com/ru1us/LAYER_3/blob/main/src/components/HeroRobot.tsx";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="font-mono text-[0.68rem] leading-relaxed bg-[#111] text-[#e8ff00] p-5 overflow-x-auto border border-[#333]">
      {children.trim()}
    </pre>
  );
}

function FolderBox({ tag, title, children }: { tag: string; title: string; children: React.ReactNode }) {
  return (
    <div className="relative border-x border-b border-border">
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
      {/* Back */}
      <div className="px-12 pt-10 pb-0">
        <Link
          to="/"
          className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text-muted hover:text-text transition-colors"
        >
          ← Back
        </Link>
      </div>

      <div className="mx-auto max-w-5xl px-12 py-12 space-y-10">
        {/* Header */}
        <div>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-3">
            Algorithm 01 · Implementation
          </p>
          <h1 className="font-doto text-5xl mb-4">CCD_IK</h1>
          <p className="font-mono text-[0.78rem] leading-relaxed text-text-muted max-w-2xl">
            Cyclic Coordinate Descent Inverse Kinematics — implemented in Three.js and React Three Fiber
            for the interactive robot arm. Below is a walkthrough of the key implementation decisions.
          </p>
          <a
            href={GH}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-5 font-mono text-[0.65rem] uppercase tracking-[0.18em] border border-border px-4 py-2 hover:bg-[#f0f0f0] transition-colors"
          >
            View full source on GitHub →
          </a>
        </div>

        {/* Section 1 */}
        <FolderBox tag="Step 01" title="BONE_CHAIN">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Concept</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                The GLB model exports an <span className="text-text">Armature → Bone → Bone.001 … Bone.006</span> hierarchy.
                On load, the chain is traversed and each bone is mapped to a{" "}
                <span className="text-text">BoneConfig</span> that defines its rotation axis and joint limits.
                Three.js strips dots from names, so <code className="text-text">Bone.001</code> becomes{" "}
                <code className="text-text">Bone001</code> at runtime.
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
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        {/* Section 2 */}
        <FolderBox tag="Step 02" title="IK_TARGET">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Concept</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                The cursor's NDC coordinates are raycasted against two planes each frame:
                a <span className="text-text">ground plane</span> (Y=0) and a{" "}
                <span className="text-text">back plane</span> facing the camera.
                Whichever intersection is closer to the camera wins. The result is smoothed
                with a lerp factor of <span className="text-text">0.08</span> so the arm
                follows with a natural lag.
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

        {/* Section 3 */}
        <FolderBox tag="Step 03" title="CCD_SOLVER">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Concept</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted mb-4">
                The solver runs <span className="text-text">8 iterations</span> per frame.
                For each joint (working from tip to base), it:
              </p>
              <ol className="space-y-2">
                {[
                  "Gets the joint's constrained rotation axis in world space",
                  "Projects both EE→joint and target→joint onto the plane perpendicular to that axis",
                  "Computes the angle between the two projected vectors",
                  "Clamps to joint limits and applies the rotation",
                ].map((s, i) => (
                  <li key={i} className="flex gap-3 font-mono text-[0.72rem] text-text-muted">
                    <span className="font-doto text-text shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Code</p>
              <CodeBlock>{`
for (let iter = 0; iter < 8; iter++) {
  for (let i = joints.length - 1; i >= 0; i--) {
    joint.getWorldQuaternion(worldQuat);
    axisWorld.copy(axisLocal)
             .applyQuaternion(worldQuat).normalize();

    eeProj.copy(toEE).projectOnPlane(axisWorld).normalize();
    tgProj.copy(toTarget).projectOnPlane(axisWorld).normalize();

    let angle = Math.acos(clamp(eeProj.dot(tgProj), -1, 1));
    cross.crossVectors(eeProj, tgProj);
    if (cross.dot(axisWorld) < 0) angle = -angle;

    joint.rotation[axis] = clamp(
      joint.rotation[axis] + angle, min, max
    );
  }
}
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        {/* Section 4 */}
        <FolderBox tag="Step 04" title="LERP_PHASE">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Concept</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                The CCD solve runs on a <span className="text-text">copy</span> of the current angles.
                The solved goal angles are then lerped toward — not applied directly — using a
                per-joint follow speed defined in <span className="text-text">BONE_FOLLOW</span>.
                The base responds fastest (0.035), the tip slowest (0.095), creating a
                whip-like follow-through that makes the arm feel heavy and alive.
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

joint.rotation[axis] = lerp(current, goal, speed);
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
