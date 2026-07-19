import { useEffect, useState } from "react";

const STORAGE_KEY = "mobile-notice-dismissed";

function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  // Coarse primary pointer (finger) or no fine pointer at all.
  if (window.matchMedia?.("(pointer: coarse)").matches) return true;
  if (window.matchMedia?.("(hover: none)").matches) return true;
  // Fallback: touch events supported and small viewport.
  if ("ontouchstart" in window && window.innerWidth < 900) return true;
  return false;
}

export default function MobileNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isTouchDevice()) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // ignore (private mode, etc.)
    }
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-notice-title"
    >
      <div
        className="relative w-[min(100%,440px)] border border-text bg-surface-raised p-7"
        style={{ boxShadow: "8px 8px 0 var(--color-text)" }}
      >
        <div className="mb-5 flex items-center gap-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-text-muted">
          <span
            className="h-2.5 w-2.5 border border-text bg-accent"
            style={{ boxShadow: "3px 3px 0 var(--color-text)" }}
          />
          <span>Notice · Touch device</span>
        </div>

        <h1
          id="mobile-notice-title"
          className="m-0 font-doto text-[clamp(1.8rem,7vw,2.6rem)] font-black uppercase leading-[0.85] tracking-[-0.04em]"
        >
          Desktop<br />recommended
        </h1>

        <p className="mt-5 max-w-md text-[0.82rem] leading-[1.7] text-text-muted">
          This site is built around real-time interactive canvases that need a
          precise pointer and a keyboard. On phones and tablets the simulations
          won&rsquo;t react properly and you&rsquo;ll miss the full experience.
        </p>

        <p className="mt-3 text-[0.82rem] leading-[1.7] text-text-muted">
          Please open it on a{" "}
          <span className="font-bold text-text">desktop or laptop browser</span>{" "}
          to interact with everything.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(STORAGE_KEY, "1");
              } catch {
                // ignore
              }
              setShow(false);
            }}
            className="flex cursor-pointer items-center gap-2 border border-text bg-text px-4 py-2.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-accent transition-colors hover:bg-accent hover:text-text"
          >
            <span aria-hidden>↳</span> Continue anyway
          </button>
        </div>
      </div>
    </div>
  );
}
