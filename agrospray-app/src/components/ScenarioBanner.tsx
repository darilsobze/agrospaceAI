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
          ? "Spraying to the line at Galileo HAS precision — error radius carried into every nozzle."
          : "Coarse uncorrected GNSS — the boom cuts early, over-buffers near trees, and can't resolve the crop seam."}
      </span>
      <span className="flex-1" />
      <span className="text-[12px] text-[#a9b2a6]">All modules share this run</span>
    </div>
  );
}
