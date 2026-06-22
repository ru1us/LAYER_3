/**
 * PauseButton – reusable sim pause/resume toggle.
 *
 * Dark-themed pill so the neon accent reads clearly on the light page.
 * Placed bottom-right of the sim section.
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
      className="group absolute bottom-6 right-6 z-20 flex items-center gap-2 rounded-full border border-[#333] bg-[#111]/85 px-4 py-1.5 font-mono text-[0.65rem] uppercase tracking-widest text-[#888] backdrop-blur-md transition-all duration-200 hover:border-accent hover:text-accent"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full transition-colors ${paused ? "bg-accent" : "bg-[#555] group-hover:bg-accent"}`}
      />
      {paused ? "Resume" : "Pause"}
    </button>
  );
}
