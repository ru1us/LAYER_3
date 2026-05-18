import { useState, useRef, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleScroll() {
      const currentY = window.scrollY;
      if (currentY < lastScrollY.current) {
        setNavVisible(true);
      } else if (currentY > lastScrollY.current && currentY > 60) {
        setNavVisible(false);
        setDropdownOpen(false);
      }
      lastScrollY.current = currentY;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* ── Navbar ────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 flex justify-center px-4 transition-transform duration-300 ${navVisible ? "translate-y-4" : "-translate-y-full"}`}>
        <div ref={navRef} className="relative flex w-full max-w-lg flex-col">
          {/* Pill */}
          <div className="flex items-center justify-between rounded-full border border-border px-6 py-3 backdrop-blur-sm">
            <Link to="/" className="font-doto text-xl tracking-ui">
              LAYER_3
            </Link>

            {/* Burger */}
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              aria-label="Menu"
              className="flex h-8 w-8 flex-col items-center justify-center gap-1.5 rounded-full transition-colors cursor-pointer"
            >
              <span className="h-px w-4 bg-text" />
              <span className="h-px w-4 bg-text" />
              <span className="h-px w-4 bg-text" />
            </button>
          </div>

          {/* Dropdown — full width of pill, below it */}
          {dropdownOpen && (
            <div ref={dropdownRef} className="mt-1 w-full rounded-2xl border border-border py-2 shadow-lg backdrop-blur-md">
              <Link
                to="/pages/ccd"
                onClick={() => setDropdownOpen(false)}
                className={`block px-6 py-2 font-mono text-sm uppercase tracking-nav transition-colors ${
                  location.pathname === "/pages/ccd"
                    ? "text-text"
                    : "text-text-muted hover:text-text"
                }`}
              >
                Robot Arm
              </Link>
              <Link
                to="/pages/fabrik"
                onClick={() => setDropdownOpen(false)}
                className={`block px-6 py-2 font-mono text-sm uppercase tracking-nav transition-colors ${
                  location.pathname === "/pages/fabrik"
                    ? "text-text"
                    : "text-text-muted hover:text-text"
                }`}
              >
                Fish Sim
              </Link>
              <Link
                to="/pages/particles"
                onClick={() => setDropdownOpen(false)}
                className={`block px-6 py-2 font-mono text-sm uppercase tracking-nav transition-colors ${
                  location.pathname === "/pages/particles"
                    ? "text-text"
                    : "text-text-muted hover:text-text"
                }`}
              >
                Particle Sim
              </Link>
              <Link
                to="/styleguide"
                onClick={() => setDropdownOpen(false)}
                className={`block px-6 py-2 font-mono text-sm uppercase tracking-nav transition-colors ${
                  location.pathname === "/styleguide"
                    ? "text-text"
                    : "text-text-muted hover:text-text"
                }`}
              >
                Styleguide
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* ── Main ─────────────────────────────── */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* ── Footer ───────────────────────────── */}
      <footer className="border-t border-border bg-surface px-8 py-7">
        <p className="text-center font-mono text-[0.7rem] uppercase tracking-label text-text-muted">
            impressum | data privacy | contact:
        </p>
      </footer>
    </div>
  );
}
