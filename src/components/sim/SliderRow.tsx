/** Labeled simulation range input. */
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
      <div className="mb-2 flex items-center justify-between font-mono text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-muted">
        <span>{label}</span>
        <span className="text-text">{display}</span>
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
