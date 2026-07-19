import type { CSSProperties, ReactNode } from "react";

/** Collapsible simulation controls. */
export function ControlsPanel({
  open,
  onToggle,
  title = "Simulation Controls",
  panelClassName = "",
  panelStyle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title?: string;
  panelClassName?: string;
  panelStyle?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className="absolute bottom-6 left-1/2 z-30 flex w-[min(92vw,680px)] -translate-x-1/2 cursor-auto flex-col items-center">
      {open && (
        <div
          className={`mb-3 w-full rounded-[10px] border border-text bg-surface-raised p-6 max-h-[42vh] overflow-y-auto ${panelClassName}`}
          style={{ boxShadow: "0 8px 24px rgba(17, 19, 16, 0.12)", ...panelStyle }}
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
