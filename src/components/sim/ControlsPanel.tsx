import type { ReactNode } from "react";

/**
 * ControlsPanel – reusable shell for sim parameter panels.
 *
 * Renders a centered bottom overlay with a toggle button and a collapsible
 * panel body. The panel body is a slot (`children`) so each sim provides its
 * own sliders/inputs.
 *
 * Light-themed to match the site navbar / settings panel.
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
        <div
          className="mb-3 w-full rounded-[10px] border border-text bg-surface-raised p-6 max-h-[42vh] overflow-y-auto"
          style={{ boxShadow: "0 8px 24px rgba(17, 19, 16, 0.12)" }}
        >
          {children}
        </div>
      )}

      <button
        onClick={onToggle}
        className={`group flex cursor-pointer items-center gap-3 rounded-[10px] border px-5 py-2.5 font-mono text-[0.63rem] font-bold uppercase tracking-[0.12em] transition-all duration-200 ${
          open
            ? "border-text bg-accent text-text"
            : "border-text bg-surface-raised text-text-muted hover:text-text"
        }`}
        style={{ boxShadow: "0 8px 24px rgba(17, 19, 16, 0.08)" }}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full transition-colors ${open ? "bg-text" : "bg-text-muted group-hover:bg-text"}`}
        />
        <span>{title}</span>
        <span className="font-doto text-lg leading-none">{open ? "−" : "+"}</span>
      </button>
    </div>
  );
}
