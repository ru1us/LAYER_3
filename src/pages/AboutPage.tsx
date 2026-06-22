import { Suspense, lazy } from "react";
import DeferredCanvas from "../components/DeferredCanvas.tsx";

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
      className="group block border border-border bg-surface p-6 transition-colors hover:bg-[#f3f3f3]"
    >
      <div className="flex items-start justify-between gap-6">
        <div>
          <h3 className="font-doto text-lg text-text">{title}</h3>
          <p className="mt-3 font-mono text-[0.72rem] leading-relaxed text-text-muted">{meta}</p>
        </div>
        <span className="font-mono text-[0.7rem] text-text-muted transition-transform group-hover:translate-x-1">→</span>
      </div>
    </a>
  );
}

export default function AboutPage() {
  return (
    <div className="bg-surface min-h-screen pt-28">
      <section className="px-8 pb-20 pt-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">About this site</p>
              <h1 className="mt-6 font-doto text-6xl leading-none text-text md:text-7xl">
                IK as a visual introduction.
              </h1>
            </div>
            <div className="border-l border-border pl-8">
              <p className="font-mono text-[0.9rem] leading-8 text-text-muted">
                This website is a small learning space for inverse kinematics: how a chain of joints can reach a target, how constraints shape motion, and how interactive 3D scenes can make those ideas easier to understand. It also serves as a practical study in Three.js, React Three Fiber, GLTF rigs, pointer interaction, animation loops, and browser-based realtime graphics.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  ["01", "IK fundamentals"],
                  ["02", "Three.js practice"],
                  ["03", "Interactive rigs"],
                ].map(([n, label]) => (
                  <div key={n} className="border border-border p-4">
                    <span className="font-doto text-xl text-text">{n}</span>
                    <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-text-muted">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border px-8 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-end">
            <div className="border border-b-0 border-border bg-surface px-5 py-2">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted">Reading</span>
              <span className="ml-4 font-doto text-sm text-text">PAPERS_AND_NOTES</span>
            </div>
            <div className="flex-1 border-t border-border" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {papers.map((paper) => (
              <LinkCard key={paper.href} {...paper} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border px-8 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-end">
            <div className="border border-b-0 border-border bg-surface px-5 py-2">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted">References</span>
              <span className="ml-4 font-doto text-sm text-text">PROJECTS_AND_DEMOS</span>
            </div>
            <div className="flex-1 border-t border-border" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <LinkCard key={project.href} {...project} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border px-8 py-16">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Extra experiment</p>
          <h2 className="mt-4 font-doto text-4xl text-text">Particle interaction study</h2>
          <p className="mt-4 max-w-2xl font-mono text-[0.78rem] leading-relaxed text-text-muted">
            The particle simulation is kept here as a separate Three.js interaction sketch. It is not part of the IK introduction, but it belongs to the same learning goal: understanding realtime browser graphics through small, tactile experiments.
          </p>
        </div>
      </section>

      <DeferredCanvas className="relative h-[640px]" fallback={<CanvasFallback />}>
        <Suspense fallback={<CanvasFallback />}>
          <ParticleSim />
        </Suspense>
      </DeferredCanvas>
    </div>
  );
}
