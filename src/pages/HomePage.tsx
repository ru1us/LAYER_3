import { useRef, useEffect, Suspense } from "react";
import { Link } from "react-router-dom";
import HeroWind from "../components/HeroWind.tsx";

const projects = [
  {
    slug: "glass-cube",
    title: "Glass Cube",
    description:
      "Interaktiver Glas-Würfel mit Refraktion, chromatischer Aberration und Physik-Simulation. Greifen, werfen, beobachten.",
    tags: ["Physik", "Transmission", "Interaktiv"],
    route: "/projects/glass-cube",
  },
  {
    slug: "wind-turbine",
    title: "Windrad-Animation",
    description:
      "Scroll-basierte 3D-Visualisierung einer Windkraftanlage mit eingebetteter Kamera und atmosphärischen Effekten.",
    tags: ["Scroll", "GLB-Kamera", "Ambiente"],
    route: "/",
  },
  {
    slug: "robot-arm",
    title: "Roboterarm",
    description:
      "Steuerbare Kinematik eines Roboterarms mit inverser Kinematik und Echtzeit-Manipulation.",
    tags: ["IK", "Controls", "Animation"],
    route: "/",
  },
  {
    slug: "solar-panel",
    title: "Solarpanel",
    description:
      "Interaktive Darstellung eines Solarpanels mit Lichteinfall-Simulation und Energieertrag-Visualisierung.",
    tags: ["Licht", "Simulation", "Daten"],
    route: "/",
  },
];

const notchClasses = ["notch-tl", "notch-tr", "notch-br", "notch-bl"];

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      scrollProgressRef.current = Math.min(1, Math.max(0, -rect.top / scrollable));
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div>
      {/* ── Hero Section ─────────────────────── */}
      <section ref={heroRef} className="relative hud-corners" style={{ height: "200vh" }}>
        <div className="sticky top-0 h-screen w-full">
          <Suspense
            fallback={
              <div
                className="flex h-full items-center justify-center"
                style={{ background: "#f0ede8" }}
              >
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.7rem",
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    color: "#777770",
                  }}
                >
                  Laden...
                </div>
              </div>
            }
          >
            <HeroWind />
          </Suspense>

          {/* ── Hero HUD overlay ──────────────── */}
          <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none" style={{ padding: "3rem" }}>
            {/* Connector line SVG */}
            <svg width="100%" height="40" className="mb-4" style={{ maxWidth: 500 }}>
              <line x1="0" y1="20" x2="100%" y2="20" stroke="#c8c4bc" strokeWidth="1" />
              <circle cx="20" cy="20" r="4" fill="#E8FF00" />
              <circle cx="50%" cy="20" r="4" fill="#c8c4bc" />
              <circle cx="480" cy="20" r="4" fill="#E8FF00" />
              {/* Pill node */}
              <rect x="80" y="8" width="80" height="24" rx="0" fill="#111111" stroke="#c8c4bc" strokeWidth="1" />
              <text x="120" y="24" textAnchor="middle" fill="#E8FF00" fontSize="9" fontFamily="monospace">WIND.GLB</text>
              <rect x="220" y="8" width="80" height="24" rx="0" fill="#111111" stroke="#E8FF00" strokeWidth="1" />
              <text x="260" y="24" textAnchor="middle" fill="#E8FF00" fontSize="9" fontFamily="monospace">ACTIVE</text>
            </svg>

            <div className="flex items-end gap-12">
              <div>
                <p className="section-label mb-3">Erneuerbare Energie</p>
                <h1 style={{ fontFamily: "'Doto', monospace", fontWeight: 700, fontSize: "2.5rem", color: "#111111", lineHeight: 1.1 }}>
                  LAYER<span style={{ color: "#E8FF00" }}>_</span>3
                </h1>
                <p style={{ fontFamily: "monospace", fontSize: "0.8rem", letterSpacing: "0.08em", color: "#777770", marginTop: "0.75rem", maxWidth: 400 }}>
                  Interaktive 3D-Visualisierungen für erneuerbare Energietechnologien.
                </p>
              </div>

              {/* Stats */}
              <div className="flex gap-8">
                <div>
                  <div className="stat-number">4</div>
                  <div className="stat-label">Projekte</div>
                </div>
                <div>
                  <div className="stat-number">3D</div>
                  <div className="stat-label">Interaktiv</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Projects Section ─────────────────── */}
      <section
        id="projekte"
        className="relative z-10 grid-bg hud-corners"
        style={{ background: "#f0ede8", padding: "5rem 3rem" }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <p className="section-label mb-3">Projekte</p>
            <h2 style={{ fontSize: "2rem", color: "#111111" }}>
              3D-Visualisierungen
            </h2>
            <p style={{ fontFamily: "monospace", fontSize: "0.8rem", letterSpacing: "0.08em", color: "#777770", marginTop: "0.75rem", maxWidth: 500 }}>
              Jedes Projekt zeigt eine interaktive 3D-Szene mit erneuerbaren Energietechnologien.
              Klicke auf ein Projekt um es im Detail zu erkunden.
            </p>
          </div>

          <div className="panel-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {projects.map((project, i) => (
              <Link
                key={project.slug}
                to={project.route}
                className={`group block p-6 transition-all duration-300 ${notchClasses[i % 4]}`}
                style={{ background: "#e8e4de" }}
              >
                {/* Preview area */}
                <div
                  className="notch-all mb-5 flex h-40 items-center justify-center"
                  style={{
                    background: "#f0ede8",
                    border: "1px solid #c8c4bc",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Doto', monospace",
                      fontWeight: 700,
                      fontSize: "2rem",
                      color: "#c8c4bc",
                    }}
                    className="group-hover:text-accent transition-colors"
                  >
                    3D
                  </span>
                </div>

                <div className="flex items-start justify-between mb-2">
                  <h3
                    style={{ fontFamily: "'Doto', monospace", fontWeight: 700, fontSize: "1rem", color: "#111111" }}
                    className="group-hover:text-accent transition-colors"
                  >
                    {project.title}
                  </h3>
                  <span
                    style={{ color: "#c8c4bc", fontSize: "1.1rem" }}
                    className="group-hover:text-accent group-hover:translate-x-1 transition-all"
                  >
                    →
                  </span>
                </div>

                <p style={{ fontFamily: "monospace", fontSize: "0.75rem", letterSpacing: "0.08em", color: "#777770", lineHeight: 1.7, marginBottom: "1rem" }}>
                  {project.description}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── About / Tech Section ─────────────── */}
      <section
        id="about"
        className="relative z-10 grid-bg"
        style={{ background: "#e8e4de", borderTop: "1px solid #c8c4bc", padding: "5rem 3rem" }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <p className="section-label mb-3">Technologie</p>
            <h2 style={{ fontSize: "2rem", color: "#111111" }}>
              Gebaut mit modernem Web-Stack
            </h2>
          </div>

          <div className="panel-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            {[
              {
                name: "Three.js",
                text: "Die führende JavaScript-Bibliothek für 3D-Grafik im Browser, basierend auf WebGL.",
                notch: "notch-tl",
              },
              {
                name: "React Three Fiber",
                text: "Ein React-Renderer für Three.js. Szenen werden deklarativ als Komponenten geschrieben.",
                notch: "notch-tr",
              },
              {
                name: "Drei",
                text: "Fertige Helfer — OrbitControls, Environments, Loader und viele weitere Utilities.",
                notch: "notch-br",
              },
            ].map((card) => (
              <div
                key={card.name}
                className={`p-6 group ${card.notch}`}
                style={{ background: "#f0ede8" }}
              >
                <h3
                  style={{ fontFamily: "'Doto', monospace", fontWeight: 700, fontSize: "0.9rem", color: "#111111", marginBottom: "0.5rem" }}
                >
                  {card.name}
                </h3>
                <p style={{ fontFamily: "monospace", fontSize: "0.75rem", letterSpacing: "0.08em", color: "#777770", lineHeight: 1.7 }}>
                  {card.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
