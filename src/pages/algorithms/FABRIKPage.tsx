import { Link } from "react-router-dom";

const GH = "https://github.com/ru1us/LAYER_3/blob/main/src/components/FishSim.tsx";

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

export default function FABRIKPage() {
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
            Algorithm 02 · Implementation
          </p>
          <h1 className="font-doto text-5xl mb-4">FABRIK</h1>
          <p className="font-mono text-[0.78rem] leading-relaxed text-text-muted max-w-2xl">
            Forward And Backward Reaching Inverse Kinematics — implemented in Three.js
            for the fish spine simulation. A position-based approach that requires no
            rotation matrices in the solve phase.
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
        <FolderBox tag="Step 01" title="2D_CHAIN">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Concept</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                The fish spine is modeled as a <span className="text-text">2D chain of 6 joints</span>{" "}
                in the XZ plane (top-down view). The segment lengths between joints are
                extracted once from the GLB bone world positions at init time and stored
                as fixed values. The FABRIK solver then works entirely in 2D —
                no 3D rotations required during the solve pass.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Code</p>
              <CodeBlock>{`
// Extract segment lengths from bone world positions
for (let i = 0; i < chain.length - 1; i++) {
  chain[i].getWorldPosition(a);
  chain[i + 1].getWorldPosition(b);
  segLens[i] = a.distanceTo(b); // fixed rest length
}

// Joints are 2D: x and z of the XZ plane
joints[i].set(worldPos.x, worldPos.z);
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        {/* Section 2 */}
        <FolderBox tag="Step 02" title="FABRIK_SOLVE">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Concept</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted mb-4">
                This implementation uses the <span className="text-text">forward pass only</span>{" "}
                (no backward re-anchor pass) since the fish has no fixed base — the whole body
                moves through space. The head is placed at the target, and each subsequent joint
                is dragged behind it at the correct segment length.
              </p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                A <span className="text-text">max-bend angle constraint</span> of ±45° per segment
                prevents the tail from folding back on itself. This is computed via the 2D cross
                product of consecutive segment directions.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Code</p>
              <CodeBlock>{`
joints[0].copy(target); // head to target

for (let i = 1; i < joints.length; i++) {
  let dir = joints[i].clone().sub(joints[i - 1]);
  dir.normalize();

  // Angle constraint vs. previous segment
  if (i >= 2) {
    const prevDir = joints[i-1].clone()
                               .sub(joints[i-2]).normalize();
    const angle = Math.atan2(
      prevDir.x * dir.y - prevDir.y * dir.x,
      prevDir.dot(dir)
    );
    const clamped = clamp(angle, -PI*0.25, PI*0.25);
    // Rotate dir by clamped angle around prevDir
    dir.set(
      prevDir.x * cos(clamped) - prevDir.y * sin(clamped),
      prevDir.x * sin(clamped) + prevDir.y * cos(clamped)
    );
  }

  joints[i] = joints[i-1] + dir * segLen[i-1];
}
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        {/* Section 3 */}
        <FolderBox tag="Step 03" title="STEERING">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Concept</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                The fish doesn't teleport to the cursor — it has a{" "}
                <span className="text-text">simulated velocity</span> and follows steering
                forces inspired by Craig Reynolds' Boids. Two forces act each frame:
                a <span className="text-text">Seek</span> force that pulls the fish toward
                the cursor, and an <span className="text-text">Orbit</span> force that pushes
                it tangentially to circle at a fixed radius. The orbit side (CW vs CCW) is
                preserved using the 2D cross product of the velocity and the to-target vector.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Code</p>
              <CodeBlock>{`
const ORBIT_R = 1.44;

// Seek
const desired = toTarget.normalize() * MAX_SPEED * seekStrength;

// Orbit tangent – preserve side via cross product
const cross2d = toTarget.x * vel.y - toTarget.y * vel.x;
const perpSign = cross2d >= 0 ? 1 : -1;
const perp = new Vec2(-toTarget.y, toTarget.x)
             .multiplyScalar(perpSign).normalize();
const orbitForce = perp * MAX_SPEED * 0.85;

// Blend seek ↔ orbit by distance
const orbitWeight = max(0,
  1 - abs(dist - ORBIT_R) / (ORBIT_R * 2)
);
const steer = lerp(desired, orbitForce, orbitWeight);
vel += clamp(steer - vel, -MAX_FORCE, MAX_FORCE);
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        {/* Section 4 */}
        <FolderBox tag="Step 04" title="BONE_ROTATION">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Concept</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                Once FABRIK gives the 2D joint positions, these need to be converted back into
                3D bone rotations. The challenge: the Blender rig has a{" "}
                <span className="text-text">−90° rest rotation</span> on the root bone.
                Applying angles naively causes roll artifacts. The solution: store each bone's{" "}
                <span className="text-text">world quaternion at rest</span>, compute only
                the yaw delta, and apply it as a pure Y-axis rotation offset.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Code</p>
              <CodeBlock>{`
// Rest forward direction of this bone in world XZ
const localFwd = new Vec3(0, 1, 0)
  .applyQuaternion(restWorldQ[i]);
const restYaw    = atan2(localFwd.x, localFwd.z);

// Desired yaw from FABRIK joint positions
const desiredYaw = atan2(dx, dz);
const deltaYaw   = desiredYaw - restYaw;

// Apply as pure world-Y rotation (no roll)
const qDelta = new Quat()
  .setFromAxisAngle(Y_AXIS, deltaYaw);
const qWorld = qDelta.multiply(restWorldQ[i]);
bone.quaternion.copy(
  parentWorldQ.invert().multiply(qWorld)
);
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        {/* Footer */}
        <div className="border-t border-border pt-8 flex items-center justify-between">
          <Link
            to="/pages/ccd"
            className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text-muted hover:text-text transition-colors"
          >
            ← Algorithm 01 — CCD
          </Link>
          <Link
            to="/"
            className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text hover:text-text-muted transition-colors"
          >
            Back to overview →
          </Link>
        </div>
      </div>
    </div>
  );
}
