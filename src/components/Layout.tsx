import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* ── Navbar ────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-transparent">
        {/* Glowing underline */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-[linear-gradient(90deg,transparent,#E8FF00,transparent)]" />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-10 py-6">
          <Link
            to="/"
            className="font-doto text-2xl tracking-ui"
          >
            LAYER_3
          </Link>

          <nav className="flex items-center gap-8">
            {[
              { to: "/", label: "Home", match: (p: string) => p === "/" },
              { to: "/projects/glass-cube", label: "Projects", match: (p: string) => p.startsWith("/projects") },
              { to: "/styleguide", label: "Styleguide", match: (p: string) => p === "/styleguide" },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`font-mono text-body uppercase tracking-nav transition-colors ${
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
      <footer className="border-t border-border bg-surface px-8 py-7">
        <p className="text-center font-mono text-[0.7rem] uppercase tracking-label text-text-muted">
          LAYER_3 — interactive 3D für erneuerbare Energien
        </p>
      </footer>
    </div>
  );
}
