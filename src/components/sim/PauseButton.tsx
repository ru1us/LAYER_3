/**
 * PauseButton – reusable sim pause/resume toggle.
 *
 * Light-themed to match the site navbar. Placed bottom-right of the sim section.
 */
export function PauseButton({
  paused,
  onToggle,
}: {
  paused: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`group absolute bottom-6 right-6 z-20 flex items-center gap-2 rounded-[10px] border px-4 py-2 font-mono text-[0.63rem] font-bold uppercase tracking-[0.12em] transition-all duration-200 ${
        paused
          ? "border-text bg-accent text-text"
          : "border-text bg-surface-raised text-text-muted hover:text-text"
      }`}
      style={{ boxShadow: "0 8px 24px rgba(17, 19, 16, 0.08)" }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full transition-colors ${paused ? "bg-text" : "bg-text-muted group-hover:bg-text"}`}
      />
      {paused ? "Resume" : "Pause"}
    </button>
  );
}
