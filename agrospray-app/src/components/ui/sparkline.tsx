export function Sparkline({ data, color, w = 78, h = 26 }: { data: number[]; color: string; w?: number; h?: number }) {
  if (!data.length) return <svg width={w} height={h} />;
  const mn = Math.min(...data),
    mx = Math.max(...data),
    rg = mx - mn || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 2 - ((v - mn) / rg) * (h - 4)]);
  const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <path d={`${path} L${w} ${h} L0 ${h} Z`} fill={`${color}22`} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
