/**
 * SliderRow – reusable labeled range input for sim controls.
 *
 * Pairs a label + live value readout with a styled range input.
 * Dark-themed to sit inside ControlsPanel; uses the accent thumb (.sim-range).
 */
export function SliderRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#888]">
        <span>{label}</span>
        <span className="text-accent">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="sim-range w-full"
      />
    </label>
  );
}
