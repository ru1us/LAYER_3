import { useRef, Suspense } from "react";
import { Link } from "react-router-dom";
import HeroRobot from "../components/HeroRobot.tsx";
import ParticleSim from "../components/ParticleSim.tsx";
import FishSim from "../components/FishSim.tsx";
import SpiderSim from "../components/SpiderSim.tsx";

// ── Reusable folder-tab box ────────────────────────────────────────────────
function AlgoBox({
  tag,
  title,
  left,
  right,
  linkTo,
}: {
  tag: string;
  title: string;
  left: React.ReactNode;
  right: React.ReactNode;
  linkTo: string;
}) {
  return (
    <section className="relative z-10 bg-surface border-t border-border px-12 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="relative">
          {/* Folder tab */}
          <div className="flex items-end">
            <div className="border border-b-0 border-border bg-surface flex items-center gap-3 px-5 py-2 shrink-0">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted">
                {tag}
              </span>
              <span className="font-doto text-sm text-text">{title}</span>
            </div>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Two-column content */}
          <div className="grid md:grid-cols-2">
            <div className="border-r border-border p-10">{left}</div>
            <div className="p-10">{right}</div>
          </div>

          {/* Footer link */}
          <div className="border-t border-border px-10 py-4 flex items-center justify-between">
            <span className="font-mono text-[0.6rem] text-text-muted uppercase tracking-[0.18em]">
              Three.js · React Three Fiber
            </span>
            <Link
              to={linkTo}
              className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-text hover:text-text-muted transition-colors flex items-center gap-2"
            >
              View Implementation
              <span className="font-mono">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      {/* ── Fish (FABRIK) ────────────────────── */}
      <FishSim />

      {/* ── FABRIK Explanation ───────────────── */}
      <AlgoBox
        tag="Algorithm 01"
        title="FABRIK"
        linkTo="/pages/fabrik"
        left={
          <>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-5">
              A different approach
            </p>
            <p className="font-mono text-[0.78rem] leading-relaxed text-text-muted mb-6">
              CCD works with <span className="text-text">angles</span>. FABRIK works with{" "}
              <span className="text-text">positions</span>. Instead of rotating joints, it
              repositions them — dragging the chain toward the target without ever computing
              a rotation matrix.
            </p>
            <div className="h-px bg-border mb-6" />
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-5">
              Forward And Backward Reaching IK
            </p>
            <p className="font-mono text-[0.78rem] leading-relaxed text-text-muted">
              FABRIK uses two passes. The <span className="text-text">forward pass</span> pulls
              the tip to the target and drags each joint behind it. The{" "}
              <span className="text-text">backward pass</span> re-anchors the base and adjusts
              the chain back forward. The result is fast, stable, and produces naturally
              flowing curves — ideal for organic chains like a fish spine.
            </p>
          </>
        }
        right={
          <>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-5">
              One Iteration — Step by Step
            </p>
            <div className="space-y-3 mb-8">
              {[
                ["01", "Move joint[0] (head) to the target position"],
                ["02", "For each next joint: maintain segment length, drag direction constrained"],
                ["03", "Apply max-bend angle constraint to prevent snake-like folding"],
                ["04", "Result: a smooth curve from head to tail following the target"],
              ].map(([n, text]) => (
                <div key={n} className="flex gap-4">
                  <span className="font-doto text-[0.7rem] text-text-muted shrink-0 w-6">{n}</span>
                  <span className="font-mono text-[0.72rem] text-text-muted">{text}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { k: "Chain joints", v: "6 (spine)" },
                { k: "Pass direction", v: "Forward only" },
                { k: "Max bend / segment", v: "45°" },
              ].map(({ k, v }) => (
                <div key={k} className="flex justify-between font-mono text-[0.72rem]">
                  <span className="text-text-muted">{k}</span>
                  <span className="text-text">{v}</span>
                </div>
              ))}
            </div>
          </>
        }
      />

      {/* ── Hero (CCD Robot) ─────────────────── */}
      <section ref={heroRef} className="relative h-screen">
        <div className="sticky top-0 h-screen w-full">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-bg">
                <div className="font-mono text-[0.7rem] tracking-caps uppercase text-text-muted">
                  Loading...
                </div>
              </div>
            }
          >
            <HeroRobot />
          </Suspense>

          <div className="absolute bottom-0 left-0 z-20 pointer-events-none p-16">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#555555] mb-2">
              Interactive
            </p>
            <h2 className="font-doto text-4xl text-[#ffffff]">CCD_IK</h2>
            <p className="font-mono text-[0.65rem] text-[#555555] mt-2 tracking-widest">
              Cyclic Coordinate Descent · follow cursor
            </p>
          </div>
        </div>
      </section>

      {/* ── CCD Explanation ──────────────────── */}
      <AlgoBox
        tag="Algorithm 02"
        title="CCD_IK"
        linkTo="/pages/ccd"
        left={
          <>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-5">
              What is Inverse Kinematics?
            </p>
            <p className="font-mono text-[0.78rem] leading-relaxed text-text-muted mb-6">
              A robotic arm has joints. If you set each joint angle manually and calculate
              where the tip ends up — that's <span className="text-text">forward kinematics</span>.{" "}
              <span className="text-text">Inverse kinematics</span> is the reverse: you define
              where the tip should be, and the algorithm figures out the joint angles.
            </p>
            <div className="h-px bg-border mb-6" />
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-5">
              Cyclic Coordinate Descent
            </p>
            <p className="font-mono text-[0.78rem] leading-relaxed text-text-muted">
              CCD solves IK <span className="text-text">iteratively</span>. Starting from the
              joint nearest the end-effector, each joint rotates by the minimum angle needed to
              bring the tip closer to the target. The cycle repeats from tip to base until the
              chain converges — typically in 6–8 passes per frame.
            </p>
          </>
        }
        right={
          <>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-5">
              One Iteration — Step by Step
            </p>
            <div className="space-y-3 mb-8">
              {[
                ["01", "Pick the joint closest to the end-effector"],
                ["02", "Compute the angle between EE → joint and target → joint"],
                ["03", "Rotate the joint by that delta, clamped to joint limits"],
                ["04", "Update world matrices and move to the next joint (toward base)"],
                ["05", "Repeat the full cycle N times until error is below threshold"],
              ].map(([n, text]) => (
                <div key={n} className="flex gap-4">
                  <span className="font-doto text-[0.7rem] text-text-muted shrink-0 w-6">{n}</span>
                  <span className="font-mono text-[0.72rem] text-text-muted">{text}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { k: "Joints", v: "6" },
                { k: "Iterations / frame", v: "8" },
                { k: "Lerp smoothing", v: "0.035 – 0.095" },
              ].map(({ k, v }) => (
                <div key={k} className="flex justify-between font-mono text-[0.72rem]">
                  <span className="text-text-muted">{k}</span>
                  <span className="text-text">{v}</span>
                </div>
              ))}
            </div>
          </>
        }
      />

      {/* ── Jacobian (Spider IK) ───────────────── */}
      <section className="relative h-screen border-t border-border">
        <div className="sticky top-0 h-screen w-full">
          <SpiderSim />
          <div className="absolute bottom-0 left-0 z-20 pointer-events-none p-16">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#555555] mb-2">
              Interactive
            </p>
            <h2 className="font-doto text-4xl text-[#ffffff]">JACOBIAN_IK</h2>
            <p className="font-mono text-[0.65rem] text-[#555555] mt-2 tracking-widest">
              Jacobian Pseudo-Inverse · spider rig
            </p>
          </div>
        </div>
      </section>

      {/* ── Jacobian Explanation ─────────────── */}
      <AlgoBox
        tag="Algorithm 03"
        title="JACOBIAN_IK"
        linkTo="/pages/jacobian"
        left={
          <>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-5">
              The Jacobian Matrix
            </p>
            <p className="font-mono text-[0.78rem] leading-relaxed text-text-muted mb-6">
              The <span className="text-text">Jacobian</span> is a matrix that maps joint
              velocities to end-effector velocities. Each column describes how much the
              end-effector moves when one joint rotates by a tiny amount — a{" "}
              <span className="text-text">linearisation</span> of the full forward kinematics
              at the current configuration.
            </p>
            <div className="h-px bg-border mb-6" />
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-5">
              Pseudo-Inverse IK
            </p>
            <p className="font-mono text-[0.78rem] leading-relaxed text-text-muted">
              To move the tip toward a target, we compute the{" "}
              <span className="text-text">position error</span> Δx and solve for joint
              angle deltas via the{" "}
              <span className="text-text">Moore–Penrose pseudo-inverse</span>: Δθ = J⁺ Δx.
              Because the system is continuously re-linearised, the chain converges
              smoothly — and unlike CCD, all joints move{" "}
              <span className="text-text">simultaneously</span> in each step.
            </p>
          </>
        }
        right={
          <>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-5">
              One Iteration — Step by Step
            </p>
            <div className="space-y-3 mb-8">
              {[
                ["01", "Compute world position of each joint via forward kinematics"],
                ["02", "Build Jacobian J: column i = (joint_axis_i) × (EE − joint_i)"],
                ["03", "Calculate error vector Δx = target − end-effector"],
                ["04", "Compute pseudo-inverse J⁺ = Jᵀ (J Jᵀ + λ²I)⁻¹  (damped LS)"],
                ["05", "Update all joint angles: Δθ = J⁺ Δx, clamp to joint limits"],
              ].map(([n, text]) => (
                <div key={n} className="flex gap-4">
                  <span className="font-doto text-[0.7rem] text-text-muted shrink-0 w-6">{n}</span>
                  <span className="font-mono text-[0.72rem] text-text-muted">{text}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { k: "Joints", v: "6" },
                { k: "Method", v: "Damped Least Squares" },
                { k: "Damping factor λ", v: "0.05" },
              ].map(({ k, v }) => (
                <div key={k} className="flex justify-between font-mono text-[0.72rem]">
                  <span className="text-text-muted">{k}</span>
                  <span className="text-text">{v}</span>
                </div>
              ))}
            </div>
          </>
        }
      />

      {/* ── Particle Sim (Bonus) ─────────────── */}
      <ParticleSim />

      {/* ── Tech stack ───────────────────────── */}
      <section
        id="about"
        className="relative z-10 bg-surface border-t border-border px-12 py-16"
      >
        <div className="mx-auto max-w-6xl">
          <div className="relative">
            <div className="flex items-end">
              <div className="border border-b-0 border-border bg-surface flex items-center gap-3 px-5 py-2 shrink-0">
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted">Stack</span>
                <span className="font-doto text-sm text-text">BUILT_WITH</span>
              </div>
              <div className="flex-1 border-t border-border" />
            </div>
            <div className="grid md:grid-cols-3">
              {[
                { name: "Three.js", text: "WebGL 3D engine. Manages scenes, cameras, geometry, materials and the render loop." },
                { name: "React Three Fiber", text: "Declarative React renderer for Three.js. Components map directly to Three.js objects." },
                { name: "Drei", text: "Utility library for R3F — loaders, controls, helpers, physics abstractions." },
              ].map(({ name, text }, i) => (
                <div
                  key={name}
                  className={`p-8 ${i < 2 ? "border-r border-border" : ""}`}
                >
                  <h3 className="font-doto text-[0.9rem] mb-3">{name}</h3>
                  <p className="font-mono text-[0.72rem] leading-relaxed text-text-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
