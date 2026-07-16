import { lazy, Suspense, useId, type ReactNode } from "react";
import DeferredCanvas from "../components/DeferredCanvas.tsx";
import { algorithmContent, type AlgorithmKey } from "../content/algorithmContent.ts";
import { navigate } from "../nav.ts";

const HeroRobot = lazy(() => import("../components/HeroRobot.tsx"));
const FishSim = lazy(() => import("../components/FishSim.tsx"));
const SpiderSim = lazy(() => import("../components/SpiderSim.tsx"));

function CanvasFallback() {
  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-bg">
      <div className="font-mono text-[0.7rem] tracking-caps uppercase text-text-muted">Loading...</div>
    </div>
  );
}

const ROW_LABEL = "block mb-3 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-text-muted";
const ROW_TEXT = "m-0 max-w-3xl text-[0.84rem] leading-[1.85] text-text-muted";
const ROW = "py-7 border-t border-border last:border-b";

const SOLVER_COMPARISON = [
  {
    criterion: "Core approach",
    fabrik: "Repositions joints with forward and backward reaching",
    ccd: "Rotates one joint at a time from tip to base",
    jacobian: "Updates all joints together from a local derivative matrix",
  },
  {
    criterion: "Target support",
    fabrik: "Position; extensions can support multiple effectors",
    ccd: "Usually end-effector position",
    jacobian: "Position and orientation; multiple tasks can be combined",
  },
  {
    criterion: "Relative cost",
    performance: true,
    fabrik: "Low · linear work per pass",
    ccd: "Low–medium · repeated joint sweeps",
    jacobian: "Medium–high · builds and solves a matrix each step",
  },
  {
    criterion: "Convergence",
    fabrik: "Typically fast and stable for position goals",
    ccd: "Reliable, but may need many sweeps or settle locally",
    jacobian: "Smooth near a solution; damping helps near singularities",
  },
  {
    criterion: "Constraints",
    fabrik: "Geometric limits need explicit constraint steps",
    ccd: "Joint limits are simple to clamp after each rotation",
    jacobian: "Flexible, but limits and secondary goals add complexity",
  },
  {
    criterion: "Pros",
    fabrik: "Simple, fast, no matrix inversion, preserves segment lengths",
    ccd: "Compact, intuitive, inexpensive, easy to constrain",
    jacobian: "Coordinated motion, pose control, handles redundant chains",
  },
  {
    criterion: "Cons",
    fabrik: "Orientation and complex constraints are not built in",
    ccd: "Joint-by-joint motion can look uneven; position-first by default",
    jacobian: "More math, tuning, memory, and compute; singularities need care",
  },
  {
    criterion: "Best suited to",
    fabrik: "Long chains and organic position-based motion",
    ccd: "Small articulated chains and real-time reaching",
    jacobian: "Robotics, full-pose tasks, and coordinated multi-joint control",
  },
] as const;

const SOLVERS = [
  { key: "fabrik", label: "FABRIK", descriptor: "Position-based" },
  { key: "ccd", label: "CCD", descriptor: "Joint-by-joint" },
  { key: "jacobian", label: "Jacobian DLS", descriptor: "Derivative-based" },
] as const;

function PerformanceInfo() {
  const tooltipId = useId();

  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label="About the performance comparison"
        aria-describedby={tooltipId}
        className="flex size-4 items-center justify-center rounded-[5px] border border-border bg-surface-raised text-[0.58rem] font-bold leading-none text-text-muted transition-colors hover:border-text hover:bg-accent hover:text-text focus-visible:border-text focus-visible:bg-accent focus-visible:text-text focus-visible:outline-none"
      >
        i
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-30 w-72 -translate-x-1/2 rounded-[10px] border border-text bg-surface-raised p-3 text-left opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-[720px]:left-0 max-[720px]:translate-x-0"
        style={{ boxShadow: "0 8px 24px rgba(17, 19, 16, 0.12)" }}
      >
        <span className="mb-2 flex justify-between border-b border-border pb-1.5 text-[0.58rem] font-bold uppercase tracking-[0.16em] text-text-muted">
          <span>Note</span>
          <span>Perf</span>
        </span>
        <span className="block text-[0.65rem] font-normal normal-case leading-[1.55] tracking-normal text-text-muted">
          Qualitative algorithm cost, not a benchmark of these scenes. In this study, rig complexity, iteration counts, eight simultaneous spider legs, rendering, physics, and model detail can cause performance issues unrelated to the solver itself.
        </span>
      </span>
    </span>
  );
}

function AlgoBox({ algorithm, id }: { algorithm: AlgorithmKey; id: string }) {
  const copy = algorithmContent[algorithm];

  return (
    <section id={id} className="scroll-mt-28 border-t border-border bg-bg py-[clamp(4rem,8vw,7rem)]">
      <div className="mx-auto w-[min(100%-80px,1100px)]">
        {/* Header */}
        <div className="mb-[clamp(2.5rem,5vw,4rem)] grid grid-cols-[200px_minmax(0,1fr)] gap-[clamp(1.5rem,4vw,4rem)] items-start max-[720px]:grid-cols-1 max-[720px]:gap-4">
          <div className="flex justify-between gap-4 pt-3 border-t-2 border-text text-[0.62rem] font-bold uppercase tracking-[0.18em] text-text-muted">
            <span className="font-doto text-[1.1rem] text-text">{copy.number}</span>
            <span>Algorithm</span>
          </div>
          <div>
            <h2 className="m-0 font-doto text-[clamp(2.4rem,5vw,5rem)] font-black uppercase leading-[0.85] tracking-[-0.045em]">{copy.title}</h2>
            <span className="mt-2.5 block text-[0.67rem] font-bold uppercase tracking-[0.2em] text-text-muted">{copy.shortLabel}</span>
          </div>
        </div>

        {/* Rows */}
        <div className={ROW}>
          <span className={ROW_LABEL}>{copy.homeIntroTitle}</span>
          <p className={ROW_TEXT}>{copy.homeIntro}</p>
        </div>
        <div className={ROW}>
          <span className={ROW_LABEL}>{copy.homeMethodTitle}</span>
          <p className={ROW_TEXT}>{copy.homeMethod}</p>
        </div>
        {copy.homeTopics?.map((topic) => (
          <div key={topic.title} className={ROW}>
            <span className={ROW_LABEL}>{topic.title}</span>
            <p className={ROW_TEXT}>{topic.text}</p>
          </div>
        ))}
        <div className={ROW}>
          <span className={ROW_LABEL}>What happens in the simulation</span>
          <div className="flex flex-col gap-3">
            {copy.homeSteps.map((text, index) => (
              <div key={text} className="flex gap-4 items-baseline">
                <span className="font-doto text-[0.75rem] text-text w-6 shrink-0">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-[0.78rem] leading-[1.7] text-text-muted">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={ROW}>
          <span className={ROW_LABEL}>Key parameters</span>
          <div className="flex flex-wrap border border-text bg-text gap-px">
            {copy.homeStats.map(({ label, value }) => (
              <div key={label} className="flex-1 min-w-[140px] flex flex-col gap-1 p-4 px-5 bg-bg">
                <span className="text-[0.58rem] font-bold uppercase tracking-[0.16em] text-text-muted">{label}</span>
                <span className="font-doto text-[1rem] text-text">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-text-muted">
          <span>Three.js · React Three Fiber</span>
          <a
            href="/about"
            onClick={(e) => {
              e.preventDefault();
              navigate("/about");
            }}
            className="text-text-muted transition-colors hover:text-text"
          >
            Learn more →
          </a>
        </div>
      </div>
    </section>
  );
}

function SimulationSection({
  id,
  children,
  label,
  title,
  subtitle,
}: {
  id: string;
  children: ReactNode;
  label: string;
  title: string;
  subtitle: string;
}) {
  return (
    <section id={id} className="relative h-screen scroll-mt-0 border-t border-border">
      <div className="sticky top-0 h-screen w-full">
        <DeferredCanvas className="h-full w-full" fallback={<CanvasFallback />}>
          <Suspense fallback={<CanvasFallback />}>{children}</Suspense>
        </DeferredCanvas>
        <div className="absolute bottom-6 left-6 z-20 flex flex-wrap items-center gap-3 pointer-events-none max-[720px]:flex-col max-[720px]:items-start max-[720px]:gap-1" style={{ maxWidth: "calc(100vw - 3rem)" }}>
          {label && <span className="text-[0.63rem] font-bold uppercase tracking-[0.12em] text-text-muted">{label}</span>}
          <span className="font-doto text-[1rem] font-black uppercase tracking-[-0.02em] text-text">{title}</span>
          <span className="text-[0.63rem] font-bold uppercase tracking-[0.12em] text-text-muted">{subtitle}</span>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div>
      <DeferredCanvas className="relative z-10 min-h-screen" fallback={<CanvasFallback />} rootMargin="75% 0px">
        <Suspense fallback={<CanvasFallback />}>
          <FishSim />
        </Suspense>
      </DeferredCanvas>
      <AlgoBox algorithm="fabrik" id="fabrik" />

      <SimulationSection
        id="ccd"
        label=""
        title="CCD_IK"
        subtitle="Cyclic Coordinate Descent · follow cursor"
      >
        <HeroRobot />
      </SimulationSection>
      <AlgoBox algorithm="ccd" id="ccd-study" />

      <SimulationSection
        id="jacobian"
        label=""
        title="JACOBIAN_IK"
        subtitle="Damped least squares · spider rig"
      >
        <SpiderSim />
      </SimulationSection>
      <AlgoBox algorithm="jacobian" id="jacobian-study" />

      <section className="border-t border-border bg-bg py-[clamp(4rem,8vw,7rem)]">
        <div className="mx-auto w-[min(100%-80px,1100px)]">
          <div className="mb-[clamp(2.5rem,5vw,4rem)] grid grid-cols-[200px_minmax(0,1fr)] gap-[clamp(1.5rem,4vw,4rem)] items-start max-[720px]:grid-cols-1 max-[720px]:gap-4">
            <div className="flex justify-between gap-4 pt-3 border-t-2 border-text text-[0.62rem] font-bold uppercase tracking-[0.18em] text-text-muted">
              <span className="font-doto text-[1.1rem] text-text">04</span>
              <span>Overview</span>
            </div>
            <div>
              <h2 className="m-0 font-doto text-[clamp(1.85rem,5vw,5rem)] font-black uppercase leading-[0.85] tracking-[-0.045em] max-[420px]:tracking-[-0.07em]">SOLVER_MATRIX</h2>
              <span className="mt-2.5 block text-[0.67rem] font-bold uppercase tracking-[0.2em] text-text-muted">Qualitative comparison</span>
            </div>
          </div>

          <div className="border border-border max-[720px]:hidden">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-text bg-surface">
                  <th scope="col" className="w-[17%] px-4 py-4 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-text-muted">Criterion</th>
                  <th scope="col" className="px-4 py-4 font-doto text-[0.9rem] font-black uppercase tracking-[0.04em] text-text">FABRIK</th>
                  <th scope="col" className="border-l border-border px-4 py-4 font-doto text-[0.9rem] font-black uppercase tracking-[0.04em] text-text">CCD</th>
                  <th scope="col" className="border-l border-border px-4 py-4 font-doto text-[0.9rem] font-black uppercase tracking-[0.04em] text-text">Jacobian DLS</th>
                </tr>
              </thead>
              <tbody>
                {SOLVER_COMPARISON.map((row, i) => (
                  <tr
                    key={row.criterion}
                    className={`align-top ${i % 2 === 0 ? "bg-bg" : "bg-surface"} ${i < SOLVER_COMPARISON.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <th scope="row" className="px-4 py-5 text-[0.61rem] font-bold uppercase tracking-[0.14em] text-text">
                      <span className="flex items-center gap-2">
                        {row.criterion}
                        {"performance" in row && row.performance && <PerformanceInfo />}
                      </span>
                    </th>
                    <td className="px-4 py-5 text-[0.72rem] leading-[1.65] text-text-muted">{row.fabrik}</td>
                    <td className="border-l border-border px-4 py-5 text-[0.72rem] leading-[1.65] text-text-muted">{row.ccd}</td>
                    <td className="border-l border-border px-4 py-5 text-[0.72rem] leading-[1.65] text-text-muted">{row.jacobian}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="hidden gap-5 max-[720px]:grid">
            {SOLVERS.map((solver, solverIndex) => (
              <article key={solver.key} className="border border-text bg-bg">
                <div className="flex items-end justify-between bg-text px-4 py-4 text-bg">
                  <div>
                    <span className="mb-1 block text-[0.55rem] font-bold uppercase tracking-[0.16em] text-bg/60">{solver.descriptor}</span>
                    <h3 className="m-0 font-doto text-[1.25rem] font-black uppercase leading-none tracking-[-0.02em]">{solver.label}</h3>
                  </div>
                  <span className="font-doto text-[0.75rem] text-bg/60">0{solverIndex + 1}</span>
                </div>
                <dl className="m-0">
                  {SOLVER_COMPARISON.map((row, i) => (
                    <div
                      key={row.criterion}
                      className={`grid grid-cols-[7.25rem_minmax(0,1fr)] gap-3 px-4 py-4 max-[420px]:grid-cols-1 max-[420px]:gap-1.5 ${i % 2 === 0 ? "bg-bg" : "bg-surface"} ${i < SOLVER_COMPARISON.length - 1 ? "border-b border-border" : ""}`}
                    >
                      <dt className="flex items-center gap-2 text-[0.58rem] font-bold uppercase tracking-[0.13em] text-text">
                        {row.criterion}
                        {"performance" in row && row.performance && <PerformanceInfo />}
                      </dt>
                      <dd className="m-0 text-[0.7rem] leading-[1.6] text-text-muted">{row[solver.key]}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>

          <p className="mt-4 text-[0.6rem] uppercase leading-[1.7] tracking-[0.12em] text-text-muted">
            General solver characteristics; actual results depend on the chain, constraints, target, implementation, and stopping criteria.
          </p>
        </div>
      </section>

      <section id="about" className="scroll-mt-28 border-t border-border bg-bg py-[clamp(4rem,8vw,7rem)]">
        <div className="mx-auto w-[min(100%-80px,1100px)]">
          <div className="mb-[clamp(2.5rem,5vw,4rem)] grid grid-cols-[200px_minmax(0,1fr)] gap-[clamp(1.5rem,4vw,4rem)] items-start max-[720px]:grid-cols-1 max-[720px]:gap-4">
            <div className="flex justify-between gap-4 pt-3 border-t-2 border-text text-[0.62rem] font-bold uppercase tracking-[0.18em] text-text-muted">
              <span className="font-doto text-[1.1rem] text-text">05</span>
              <span>Stack</span>
            </div>
            <div>
              <h2 className="m-0 font-doto text-[clamp(2.4rem,5vw,5rem)] font-black uppercase leading-[0.85] tracking-[-0.045em]">BUILT_WITH</h2>
              <span className="mt-2.5 block text-[0.67rem] font-bold uppercase tracking-[0.2em] text-text-muted">Tools and libraries</span>
            </div>
          </div>
          <div className={ROW}>
            <span className={ROW_LABEL}>Three.js</span>
            <p className={ROW_TEXT}>The 3D engine that manages scenes, cameras, models, materials, and the render loop.</p>
          </div>
          <div className={ROW}>
            <span className={ROW_LABEL}>React Three Fiber</span>
            <p className={ROW_TEXT}>A React renderer that lets the simulations describe Three.js scenes as components.</p>
          </div>
          <div className={ROW}>
            <span className={ROW_LABEL}>Drei</span>
            <p className={ROW_TEXT}>A set of practical helpers for model loading, lighting, controls, and reusable 3D setup.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
