import { useSim } from "@/state/sim";
import { Badge } from "./ui/badge";

export function ScenarioBanner() {
  const { receiver } = useSim();
  const is1 = receiver === "1m";
  return (
    <div className="mt-3.5 flex items-center gap-3 rounded-full border border-line bg-card px-4 py-2.5 text-[13px] text-mut">
      <Badge tone={is1 ? "green" : "orange"}>{is1 ? "1 M CORRECTED" : "5 M STANDARD"}</Badge>
      <span>
        {is1
          ? "Galileo HAS precision (~1 m) — real Zurich error profile, corrected magnitude."
          : "Real Zurich GNSS error replayed (RMS ~4.4 m, max ~24 m urban multipath)."}
      </span>
      <span className="flex-1" />
      <Badge tone="grey">REAL GNSS · Zurich Urban MAV</Badge>
    </div>
  );
}
