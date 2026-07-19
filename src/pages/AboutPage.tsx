import { Suspense, lazy } from "react";
import DeferredCanvas from "../components/DeferredCanvas.tsx";
import { AlgorithmSection } from "../components/AlgorithmLayout.tsx";

const ParticleSim = lazy(() => import("../components/ParticleSim.tsx"));

const papers = [
  {
    title: "FABRIK: A fast, iterative solver for the Inverse Kinematics problem",
    meta: "Aristidou & Lasenby · Graphical Models · 2011",
    href: "https://www.andreasaristidou.com/publications/papers/FABRIK.pdf",
  },
  {
    title: "Introduction to Inverse Kinematics with Jacobian Transpose, Pseudoinverse and Damped Least Squares methods",
    meta: "Samuel R. Buss · survey notes · 2004",
    href: "https://mathweb.ucsd.edu/~sbuss/ResearchWeb/ikmethods/iksurvey.pdf",
  },
  {
    title: "Inverse Kinematic Solutions With Singularity Robustness for Robot Manipulator Control",
    meta: "Nakamura & Hanafusa · ASME · 1986",
    href: "https://doi.org/10.1115/1.3143764",
  },
  {
    title: "Resolved Motion Rate Control of Manipulators and Human Prostheses",
    meta: "Whitney · IEEE · 1969",
    href: "https://doi.org/10.1109/T-MMS.1969.299896",
  },
];

const projects = [
  {
    title: "closed-chain-ik-js",
    meta: "Closed-chain IK constraints and browser demos by Garrett Johnson",
    href: "https://gkjohnson.github.io/closed-chain-ik-js/dist/index.html",
  },
  {
    title: "gkjohnson/closed-chain-ik-js",
    meta: "Source code for the closed-chain IK solver and examples",
    href: "https://github.com/gkjohnson/closed-chain-ik-js",
  },
  {
    title: "jsantell/THREE.IK",
    meta: "Inverse kinematics utilities built around Three.js skeletons",
    href: "https://github.com/jsantell/THREE.IK",
  },
  {
    title: "pmndrs/react-three-fiber",
    meta: "React renderer for Three.js used to structure the interactive scenes",
    href: "https://github.com/pmndrs/react-three-fiber",
  },
];

function CanvasFallback() {
  return (
    <div className="flex h-[640px] items-center justify-center bg-bg">
      <div className="font-mono text-[0.7rem] uppercase tracking-caps text-text-muted">Loading...</div>
    </div>
  );
}

function LinkCard({ title, meta, href }: { title: string; meta: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start justify-between gap-6 bg-bg p-6 px-7 transition-colors hover:bg-surface-hover"
    >
      <div>
        <h3 className="m-0 font-doto text-[1rem] font-black leading-[1.2] text-text">{title}</h3>
        <p className="mt-2.5 text-[0.72rem] leading-[1.6] text-text-muted">{meta}</p>
      </div>
      <span className="shrink-0 text-[0.8rem] font-bold text-text-muted transition-all group-hover:translate-x-1 group-hover:text-text">→</span>
    </a>
  );
}

function LinkGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 border border-text bg-text gap-px max-[720px]:grid-cols-1">
      {children}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="pt-[clamp(5rem,10vw,8rem)] pb-12">
        <div className="mx-auto w-[min(100%-80px,1100px)]">
          <div className="mb-6 flex items-center gap-3 text-[0.67rem] font-bold uppercase tracking-[0.2em] text-text-muted">
            <span className="h-2.5 w-2.5 bg-accent border border-text" style={{ boxShadow: "4px 4px 0 var(--color-text)" }} />
            <span>About this site</span>
          </div>
          <h1 className="m-0 font-doto text-[clamp(3rem,8vw,7rem)] font-black uppercase leading-[0.82] tracking-[-0.045em]">IK as a visual introduction</h1>
          <p className="mt-6 max-w-2xl text-[0.84rem] leading-[1.85] text-text-muted">
            This website is a small interactive playground for inverse kinematics: how a chain of joints can reach a target, how constraints shape motion, and how interactive 3D scenes can make those ideas easier to understand. It also serves as a practical study in Three.js, React Three Fiber, GLTF rigs, pointer interaction, animation loops, and browser-based realtime graphics.
          </p>
          <div className="mt-8 flex max-w-md flex-wrap border border-text bg-text gap-px">
            {[
              ["01", "IK fundamentals"],
              ["02", "Three.js practice"],
              ["03", "Interactive rigs"],
            ].map(([n, label]) => (
              <div key={n} className="flex-1 min-w-[120px] flex flex-col gap-1 p-4 bg-bg">
                <span className="font-doto text-[1rem] text-text">{n}</span>
                <span className="text-[0.58rem] font-bold uppercase tracking-[0.16em] text-text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AlgorithmSection number="01" label="Reading" title="PAPERS_AND_NOTES">
        <LinkGrid>
          {papers.map((paper) => (
            <LinkCard key={paper.href} {...paper} />
          ))}
        </LinkGrid>
      </AlgorithmSection>

      <AlgorithmSection number="02" label="References" title="PROJECTS_AND_DEMOS">
        <LinkGrid>
          {projects.map((project) => (
            <LinkCard key={project.href} {...project} />
          ))}
        </LinkGrid>
      </AlgorithmSection>

      <AlgorithmSection number="03" label="Extra experiment" title="PARTICLE_STUDY">
        <p className="m-0 max-w-3xl text-[0.84rem] leading-[1.85] text-text-muted">
          The particle simulation is kept here as a separate Three.js interaction sketch. It is not part of the IK introduction, but it belongs to the same learning goal: understanding realtime browser graphics through small, tactile experiments.
        </p>
      </AlgorithmSection>

      <DeferredCanvas className="relative h-[640px]" fallback={<CanvasFallback />}>
        <Suspense fallback={<CanvasFallback />}>
          <ParticleSim />
        </Suspense>
      </DeferredCanvas>
    </div>
  );
}
