import { lazy, Suspense, type ReactNode } from "react";
import DeferredCanvas from "../components/DeferredCanvas.tsx";
import { algorithmContent, type AlgorithmKey } from "../content/algorithmContent.ts";

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
          <span>Scroll study section</span>
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
    <section id={id} className="relative h-screen scroll-mt-28 border-t border-border">
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

      <section id="about" className="scroll-mt-28 border-t border-border bg-bg py-[clamp(4rem,8vw,7rem)]">
        <div className="mx-auto w-[min(100%-80px,1100px)]">
          <div className="mb-[clamp(2.5rem,5vw,4rem)] grid grid-cols-[200px_minmax(0,1fr)] gap-[clamp(1.5rem,4vw,4rem)] items-start max-[720px]:grid-cols-1 max-[720px]:gap-4">
            <div className="flex justify-between gap-4 pt-3 border-t-2 border-text text-[0.62rem] font-bold uppercase tracking-[0.18em] text-text-muted">
              <span className="font-doto text-[1.1rem] text-text">04</span>
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
