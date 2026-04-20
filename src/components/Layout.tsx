import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "#f0ede8" }}>
      {/* ── Navbar ────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          background: "transparent",
          borderBottom: "1px solid #c8c4bc",
        }}
      >
        {/* Glowing underline */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background: "linear-gradient(90deg, transparent, #E8FF00, transparent)",
          }}
        />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
          <Link
            to="/"
            style={{ fontFamily: "'Doto', monospace", fontWeight: 700, color: "#111111", letterSpacing: "0.08em" }}
            className="text-sm hover:opacity-80 transition-opacity"
          >
            LAYER<span style={{ color: "#E8FF00" }}>_</span>3
          </Link>

          <nav className="flex items-center gap-8">
            {[
              { to: "/", label: "Home", match: (p: string) => p === "/" },
              { to: "/projects/glass-cube", label: "Projekte", match: (p: string) => p.startsWith("/projects") },
              { to: "/styleguide", label: "Styleguide", match: (p: string) => p === "/styleguide" },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                }}
                className={`transition-colors ${
                  link.match(location.pathname)
                    ? "text-text"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Main ─────────────────────────────── */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* ── Footer ───────────────────────────── */}
      <footer
        className="px-8 py-7"
        style={{ borderTop: "1px solid #c8c4bc", background: "#e8e4de" }}
      >
        <p
          className="text-center"
          style={{
            fontFamily: "monospace",
            fontSize: "0.7rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#777770",
          }}
        >
          LAYER_3 — interactive 3D für erneuerbare Energien
        </p>
      </footer>
    </div>
  );
}
