export function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  foot,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  foot?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[12px] text-mut">
        <span>{label}</span>
        <b className="font-mono text-ink">{display}</b>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {foot && <div className="mt-1 text-[11.5px] text-mut">{foot}</div>}
    </div>
  );
}
