import type { ReactNode } from "react";

/**
 * ControlsPanel – reusable shell for sim parameter panels.
 *
 * Renders a centered bottom overlay with a toggle button and a collapsible
 * panel body. The panel body is a slot (`children`) so each sim provides its
 * own sliders/inputs.
 *
 * Dark-themed so the neon accent reads clearly on the light page.
 */
export function ControlsPanel({
  open,
  onToggle,
  title = "Simulation Controls",
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="absolute bottom-6 left-1/2 z-30 flex w-[min(92vw,680px)] -translate-x-1/2 flex-col items-center">
      {open && (
        <div className="mb-3 w-full rounded-2xl border border-[#2a2a2a] bg-[#111]/90 p-6 shadow-2xl backdrop-blur-md max-h-[42vh] overflow-y-auto">
          {children}
        </div>
      )}

      <button
        onClick={onToggle}
        className={`group flex cursor-pointer items-center gap-3 rounded-full border px-6 py-3 font-mono text-[0.7rem] uppercase tracking-[0.16em] backdrop-blur-md transition-all duration-200 ${
          open
            ? "border-accent bg-[#111] text-accent shadow-[0_0_24px_-4px_var(--color-accent-glow)]"
            : "border-[#333] bg-[#111]/85 text-[#888] hover:border-accent hover:text-accent"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full transition-colors ${open ? "bg-accent" : "bg-[#555] group-hover:bg-accent"}`}
        />
        <span>{title}</span>
        <span className="font-doto text-lg leading-none">{open ? "−" : "+"}</span>
      </button>
    </div>
  );
}
