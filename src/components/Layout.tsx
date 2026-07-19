import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useSettings } from "./SettingsContext";
import { GlobalStatsOverlay } from "./CanvasStats";
import { navigate, type Page } from "../nav.ts";

const HOME_SECTIONS = ["fabrik", "ccd", "jacobian"] as const;

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  );
}

function go(event: ReactMouseEvent<HTMLAnchorElement>, href: string) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  navigate(href);
}

export default function Layout({
  page,
  pathname,
  hash,
  children,
}: {
  page: Page;
  pathname: string;
  hash: string;
  children: ReactNode;
}) {
  const { quality, setQuality, showStats, toggleStats } = useSettings();
  const [activeKey, setActiveKey] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const ticking = useRef(false);

  useEffect(() => {
    if (page === "about") {
      setActiveKey("about");
    } else if (page === "home" && hash) {
      setActiveKey(decodeURIComponent(hash.slice(1)));
    } else if (page === "home") {
      setActiveKey("fabrik");
    } else {
      setActiveKey("");
    }
  }, [page, hash]);

  useEffect(() => {
    if (page !== "home") return;

    function updateActive() {
      const navHeight = navRef.current?.getBoundingClientRect().height ?? 64;
      const threshold = navHeight + 100;
      let next: string = "fabrik";

      for (const id of HOME_SECTIONS) {
        const el = document.getElementById(id);
        if (el && window.scrollY + threshold >= el.offsetTop) {
          next = id;
        }
      }

      setActiveKey(next);
      ticking.current = false;
    }

    function onScroll() {
      if (!ticking.current) {
        requestAnimationFrame(updateActive);
        ticking.current = true;
      }
    }

    updateActive();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [page]);

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        // Canvases use scroll-mt-0; text sections use scroll-mt-28.
        requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname, hash]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleHomeClick(event: ReactMouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setActiveKey("fabrik");
    if (page === "home" && !hash) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    navigate("/");
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="site-header">
        <div ref={navRef} className="site-nav">
          <nav className="site-links" aria-label="Primary navigation">
            <a className={activeKey === "fabrik" ? "is-active" : ""} href="/" onClick={handleHomeClick}>FABRIK</a>
            <a className={activeKey === "ccd" ? "is-active" : ""} href="/#ccd" onClick={(e) => go(e, "/#ccd")}>CCD</a>
            <a className={activeKey === "jacobian" ? "is-active" : ""} href="/#jacobian" onClick={(e) => go(e, "/#jacobian")}>JACOBIAN</a>
            <a className={activeKey === "about" ? "is-active" : ""} href="/about" onClick={(e) => go(e, "/about")}>ABOUT</a>
          </nav>

          <div className="site-settings-wrap">
            <button
              className={`site-icon-button ${settingsOpen ? "is-active" : ""}`}
              onClick={() => setSettingsOpen((open) => !open)}
              aria-label="Open settings"
              aria-expanded={settingsOpen}
            >
              <SettingsIcon />
            </button>

            {settingsOpen && (
              <div className="site-settings-panel">
                <div className="site-panel-heading"><span>SETTINGS</span><span>SYS / 01</span></div>
                <div className="site-setting-row">
                  <div><strong>Render quality</strong><span>Canvas detail</span></div>
                  <div className="site-segmented">
                    <button className={quality === "high" ? "is-active" : ""} onClick={() => setQuality("high")}>HIGH</button>
                    <button className={quality === "performance" ? "is-active" : ""} onClick={() => setQuality("performance")}>PERF</button>
                  </div>
                </div>
                <div className="site-setting-row">
                  <div><strong>System display</strong><span>FPS and GPU data</span></div>
                  <button className={`site-switch ${showStats ? "is-on" : ""}`} onClick={toggleStats} aria-pressed={showStats}>
                    <i />
                    <span>{showStats ? "ON" : "OFF"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      {page !== "styleguide" && (
        <footer className="border-t border-border bg-surface px-8 py-7">
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center font-mono text-[0.7rem] uppercase tracking-label text-text-muted">
            <a href="/imprint" className="transition-colors hover:text-text" onClick={(e) => go(e, "/imprint")}>Imprint</a>
            <span aria-hidden="true">|</span>
            <a href="/privacy" className="transition-colors hover:text-text" onClick={(e) => go(e, "/privacy")}>Data privacy</a>
            <span aria-hidden="true">|</span>
            <a href="mailto:plagarufus@gmail.com" className="transition-colors hover:text-text">Contact</a>
          </p>
        </footer>
      )}

      <GlobalStatsOverlay />
    </div>
  );
}
