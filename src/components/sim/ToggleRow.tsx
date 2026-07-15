/**
 * ToggleRow – reusable labeled on/off switch for sim controls.
 *
 * Mirrors SliderRow's layout (label + value readout) so both sit
 * cleanly side-by-side inside ControlsPanel.
 * Light-themed to match the navbar's .site-switch style.
 */
export function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="block cursor-pointer select-none">
      <div className="mb-2 flex items-center justify-between font-mono text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-muted">
        <span>{label}</span>
        <span className="text-text">{value ? "ON" : "OFF"}</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-1.5 w-full rounded-full border transition-colors duration-200 ${value ? "border-text bg-accent/40" : "border-border bg-surface-hover"}`}
      >
        <span
          className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-all duration-200 ${
            value
              ? "left-[calc(100%-0.75rem)] bg-text"
              : "left-0 bg-text-muted"
          }`}
        />
      </button>
    </label>
  );
}
