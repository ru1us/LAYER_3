import { useState, useRef, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useSettings } from "./SettingsContext";
import { GlobalStatsOverlay } from "./CanvasStats";

export default function Layout() {
  const location = useLocation();
  const { quality, setQuality, showStats, toggleStats } = useSettings();
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

  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!target) return;
    requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [location]);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* ── Navbar ────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 flex justify-center px-4 transition-transform duration-300 ${navVisible ? "translate-y-4" : "-translate-y-full"}`}>
        <div ref={navRef} className="relative flex w-full max-w-4xl flex-col">
          {/* Pill */}
          <div className="flex items-center justify-between gap-6 rounded-full border border-border bg-surface/75 px-6 py-3 backdrop-blur-md">
            <Link to="/" onClick={() => setDropdownOpen(false)} className="font-doto text-xl tracking-ui">
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
                to="/"
                onClick={() => {
                  setDropdownOpen(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="block px-6 py-2 font-mono text-sm uppercase tracking-nav text-text-muted transition-colors hover:text-text"
              >
                FABRIK
              </Link>
              <Link
                to="/#ccd"
                onClick={() => setDropdownOpen(false)}
                className="block px-6 py-2 font-mono text-sm uppercase tracking-nav text-text-muted transition-colors hover:text-text"
              >
                CCD
              </Link>
              <Link
                to="/#jacobian"
                onClick={() => setDropdownOpen(false)}
                className="block px-6 py-2 font-mono text-sm uppercase tracking-nav text-text-muted transition-colors hover:text-text"
              >
                Jacobian
              </Link>
              <Link
                to="/about"
                onClick={() => setDropdownOpen(false)}
                className={`block px-6 py-2 font-mono text-sm uppercase tracking-nav transition-colors ${
                  location.pathname === "/about"
                    ? "text-text"
                    : "text-text-muted hover:text-text"
                }`}
              >
                About
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

              {/* ── Settings ─────────────────────────────────────────── */}
              <div className="mt-1 border-t border-border pt-2">
                {/* Render quality */}
                <div className="flex items-center justify-between gap-4 px-6 py-2">
                  <span className="font-mono text-[0.7rem] uppercase tracking-nav text-text-muted">
                    Render Quality
                  </span>
                  <div className="flex rounded-full border border-border p-0.5">
                    <button
                      onClick={() => setQuality("high")}
                      className={`rounded-full px-3 py-1 font-mono text-[0.6rem] uppercase tracking-nav transition-colors ${
                        quality === "high"
                          ? "bg-text text-bg"
                          : "text-text-muted hover:text-text"
                      }`}
                    >
                      High
                    </button>
                    <button
                      onClick={() => setQuality("performance")}
                      className={`rounded-full px-3 py-1 font-mono text-[0.6rem] uppercase tracking-nav transition-colors ${
                        quality === "performance"
                          ? "bg-text text-bg"
                          : "text-text-muted hover:text-text"
                      }`}
                    >
                      Perf
                    </button>
                  </div>
                </div>

                {/* Sys display */}
                <div className="flex items-center justify-between gap-4 px-6 py-2">
                  <span className="font-mono text-[0.7rem] uppercase tracking-nav text-text-muted">
                    Sys Display
                  </span>
                  <button
                    onClick={toggleStats}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[0.6rem] uppercase tracking-nav transition-colors ${
                      showStats
                        ? "border-accent text-accent"
                        : "border-border text-text-muted hover:text-text"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full transition-colors ${
                        showStats ? "bg-accent" : "bg-text-muted/50"
                      }`}
                    />
                    {showStats ? "On" : "Off"}
                  </button>
                </div>
              </div>
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

      {/* ── Site-wide sys overlay ────────────── */}
      <GlobalStatsOverlay />
    </div>
  );
}
