import { Link } from "react-router-dom";

const examples = [
  {
    slug: "rotating-cube",
    title: "Glass Cube",
    description:
      "Grab and throw a glass cube with real refraction, chromatic aberration and physics. Text behind it distorts through the transmission material.",
    tools: ["MeshTransmissionMaterial", "@react-three/rapier"],
    difficulty: "Beginner",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      {/* Hero */}
      <section className="py-20">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-text-muted">
          Interactive 3D learning
        </p>
        <h1 className="mb-5 text-4xl font-light leading-tight tracking-tight text-text">
          Learn Three.js by building
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-text-muted">
          Hands-on examples that show you which tools to use and why.
          Each one is self-contained, interactive, and explained step by step.
        </p>
      </section>

      {/* Stack */}
      <section className="py-10">
        <h2 className="mb-6 text-xs uppercase tracking-[0.2em] text-text-muted">
          Stack
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              name: "Three.js",
              text: "The most popular JavaScript 3D library, built on WebGL.",
            },
            {
              name: "React Three Fiber",
              text: "A React renderer for Three.js. Write scenes declaratively as components.",
            },
            {
              name: "Drei",
              text: "Ready-made helpers — OrbitControls, environments, loaders and more.",
            },
          ].map((card) => (
            <div key={card.name} className="glass rounded-lg p-5">
              <h3 className="mb-2 text-sm font-medium text-text">{card.name}</h3>
              <p className="text-xs leading-relaxed text-text-muted">{card.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Examples */}
      <section className="py-10 pb-20">
        <h2 className="mb-6 text-xs uppercase tracking-[0.2em] text-text-muted">
          Examples
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {examples.map((ex) => (
            <Link
              key={ex.slug}
              to={`/examples/${ex.slug}`}
              className="glass group block rounded-lg p-5 transition-all hover:-translate-y-0.5"
            >
              <div className="mb-3 flex justify-between items-center">
                <span className="text-xs text-text-muted">{ex.difficulty}</span>
                <span className="text-text-muted transition-transform group-hover:translate-x-1">&rarr;</span>
              </div>
              <h3 className="mb-2 text-sm font-medium text-text">
                {ex.title}
              </h3>
              <p className="mb-4 text-xs leading-relaxed text-text-muted">
                {ex.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ex.tools.map((tool) => (
                  <span
                    key={tool}
                    className="rounded border border-border px-2 py-0.5 font-mono text-[10px] text-text-muted"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </Link>
          ))}

          <div className="rounded-lg border border-dashed border-border p-5 opacity-40">
            <h3 className="mb-2 text-sm font-medium text-text-muted">
              More coming soon
            </h3>
            <p className="text-xs text-text-muted">
              Lighting, shadows, textures, animations and more.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
