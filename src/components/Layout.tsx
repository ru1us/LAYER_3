import { Link, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border px-8 py-5 backdrop-blur-2xl bg-bg/60">
        <Link
          to="/"
          className="text-sm font-medium tracking-wide text-text-muted hover:text-text"
        >
          LAYER_3
        </Link>
        <nav className="flex gap-8 text-sm">
          <Link to="/" className="text-text-muted transition-colors hover:text-text">
            Home
          </Link>
          <Link
            to="/examples/rotating-cube"
            className="text-text-muted transition-colors hover:text-text"
          >
            Examples
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border px-8 py-6 text-center text-xs text-text-muted tracking-wide">
        LAYER_3 — learn 3d on the web
      </footer>
    </div>
  );
}
