import { Suspense } from "react";
import { Link } from "react-router-dom";
import SpiderSim from "../../components/SpiderSim.tsx";

const GH = "https://github.com/ru1us/LAYER_3";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="font-mono text-[0.68rem] leading-relaxed bg-[#111] text-[#e8ff00] p-5 overflow-x-auto border border-[#333]">
      {children.trim()}
    </pre>
  );
}

function FolderBox({
  tag,
  title,
  children,
}: {
  tag: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div className="flex items-end">
        <div className="border border-b-0 border-border bg-surface flex items-center gap-3 px-5 py-2 shrink-0">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted">
            {tag}
          </span>
          <span className="font-doto text-sm text-text">{title}</span>
        </div>
        <div className="flex-1 border-t border-border" />
      </div>
      <div className="p-10">{children}</div>
    </div>
  );
}

export default function JacobianPage() {
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
            Algorithm 03 · Three.js Implementation
          </p>
          <h1 className="font-doto text-5xl mb-4">JACOBIAN_IK</h1>
          <p className="font-mono text-[0.78rem] leading-relaxed text-text-muted max-w-2xl">
            A walkthrough of Jacobian Pseudo-Inverse inverse kinematics — building the
            Jacobian matrix from joint transforms, computing the damped least-squares
            solution, and updating all joint angles simultaneously each frame.
          </p>
          <a
            href={GH}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 mt-5 border border-border px-4 py-2 hover:bg-[#f0f0f0] transition-colors"
          >
            <img src="/GitHub_Logo.svg" alt="GitHub" className="h-4 w-auto" />
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em]">
              ru1us/LAYER_3
            </span>
          </a>
        </div>
      </div>

      {/* Spider IK canvas */}
      <div className="relative h-screen border-t border-border overflow-hidden">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center bg-bg">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.3em] text-text-muted">
                Loading...
              </span>
            </div>
          }
        >
          <SpiderSim />
        </Suspense>
      </div>

      <div className="mx-auto max-w-5xl px-12 py-12 space-y-10">
        <FolderBox tag="Step 01" title="JACOBIAN_MATRIX">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">
                Concept
              </p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                The <span className="text-text">Jacobian J</span> is a 3×n matrix (3 spatial
                dimensions, n joints). Column i is the cross product of the i-th joint's
                world-space rotation axis and the vector from that joint to the end-effector:{" "}
                <span className="text-text">Jᵢ = axisᵢ × (EE − jointᵢ)</span>. This gives
                the instantaneous linear velocity of the end-effector caused by a unit angular
                velocity at joint i.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">
                Code
              </p>
              <CodeBlock>{`
function buildJacobian(
  joints: THREE.Object3D[],
  ee: THREE.Vector3
): number[][] {
  return joints.map((joint) => {
    const axis = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(joint.getWorldQuaternion(new THREE.Quaternion()));
    const r = new THREE.Vector3().subVectors(ee, joint.getWorldPosition(new THREE.Vector3()));
    return axis.cross(r).toArray(); // [vx, vy, vz]
  });
}
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        <FolderBox tag="Step 02" title="DAMPED_LEAST_SQUARES">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">
                Concept
              </p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                The plain pseudo-inverse <span className="text-text">J⁺ = Jᵀ(JJᵀ)⁻¹</span>{" "}
                becomes numerically unstable near singularities. The{" "}
                <span className="text-text">damped least-squares</span> (DLS) variant adds a
                small identity term: <span className="text-text">J⁺ = Jᵀ(JJᵀ + λ²I)⁻¹</span>.
                The damping factor λ limits joint velocity near singular configurations,
                trading accuracy for stability.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">
                Code
              </p>
              <CodeBlock>{`
const LAMBDA = 0.05; // damping factor

// JJᵀ + λ²I  (3×3 matrix)
const JJT = multiply(J, transpose(J));
for (let i = 0; i < 3; i++)
  JJT[i][i] += LAMBDA * LAMBDA;

// pseudo-inverse: Jᵀ (JJᵀ + λ²I)⁻¹
const Jpinv = multiply(transpose(J), invert3x3(JJT));
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        <FolderBox tag="Step 03" title="JOINT_UPDATE">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">
                Concept
              </p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                With the pseudo-inverse in hand, computing the joint-angle deltas is a
                matrix–vector multiplication:{" "}
                <span className="text-text">Δθ = J⁺ Δx</span>, where{" "}
                <span className="text-text">Δx = target − EE</span> is the positional error.
                Each Δθᵢ is clamped to the joint's angle limits and added to the current
                angle. Because all joints move simultaneously, the chain tends to use the
                whole arm rather than bending only the joint nearest the tip.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">
                Code
              </p>
              <CodeBlock>{`
const dx = target.clone().sub(eePos).toArray();
const dTheta = multiplyMatVec(Jpinv, dx); // n-vector

joints.forEach((joint, i) => {
  const delta = THREE.MathUtils.clamp(
    dTheta[i],
    -MAX_DELTA,
    MAX_DELTA
  );
  joint.rotation.y = THREE.MathUtils.clamp(
    joint.rotation.y + delta,
    limits[i].min,
    limits[i].max
  );
  joint.updateWorldMatrix(true, true);
});
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>
      </div>
    </div>
  );
}
