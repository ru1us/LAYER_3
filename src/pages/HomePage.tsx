import { useRef, Suspense } from "react";
import HeroRobot from "../components/HeroRobot.tsx";

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      {/* ── Hero Section ─────────────────────── */}
      <section ref={heroRef} className="relative h-screen">
        <div className="sticky top-0 h-screen w-full">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-[#f0ede8]">
                <div className="font-mono text-[0.7rem] tracking-caps uppercase text-[#777770]">
                  Loading...
                </div>
              </div>
            }
          >
            <HeroRobot />
          </Suspense>

          {/* ── Hero HUD overlay ──────────────── */}
          <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none p-16">
            <div className="flex items-end gap-16">
              <div>
                <p className="section-label mb-4">Robotics</p>
                <h1 className="font-doto text-8xl">
                  LAYER_3
                </h1>
                <p className="font-mono text-body text-text-muted mt-4 max-w-[480px]">
                  Interactive 3D- Visualization of robotic systems and inverse kinematics.  
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Projects Section ─────────────────── */}
      <section
        id="projekte"
        className="relative z-10 grid-bg bg-[#f0ede8] px-12 py-20"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <p className="section-label mb-3">Projects</p>
            <h2 className="text-heading">
              Projects
            </h2>
            <p className="font-mono text-body text-text-muted mt-3 max-w-[500px]">
              Each project showcases an interactive 3D scene exploring renewable energy and robotics. Click a project to explore it in detail.
            </p>
          </div>
        </div>
      </section>

      {/* ── About / Tech Section ─────────────── */}
      <section
        id="about"
        className="relative z-10 grid-bg bg-[#e8e4de] border-t border-[#c8c4bc] px-12 py-20"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <p className="section-label mb-3">Technology</p>
            <h2 className="text-heading">
              Built with modern web stack
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                name: "Three.js",
                text: "The leading JavaScript library for 3D graphics in the browser, based on WebGL.",
              },
              {
                name: "React Three Fiber",
                text: "A React renderer for Three.js. Scenes are written declaratively as components.",
              },
              {
                name: "Drei",
                text: "Ready-made helpers — OrbitControls, Environments, Loader, and many more utilities.",
              },
            ].map((card) => (
              <div key={card.name} className="space-y-3">
                <h3 className="font-doto font-bold text-body mb-0">{card.name}</h3>
                <p className="font-mono text-small text-text-muted">{card.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
