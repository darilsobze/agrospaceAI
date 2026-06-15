import { useSim } from "@/state/sim";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Segmented } from "./ui/segmented";
import { cn } from "@/lib/utils";

export function BoomStrip() {
  const { decision: d, master, setMaster } = useSim();
  const tone = d.kind === "ok" ? "green" : d.kind === "warn" ? "orange" : "coral";
  return (
    <Card className="mt-3.5">
      <div className="flex items-center justify-between">
        <span className="upper">Boom — 6 nozzles · field side → organic line</span>
        <div className="flex items-center gap-2">
          <Segmented
            options={[
              { value: "auto", label: "AUTO" },
              { value: "off", label: "MASTER OFF" },
            ]}
            value={master}
            onChange={setMaster}
            activeClass="bg-orange text-white"
          />
          <Badge tone={tone}>{d.kind === "ok" ? "all active" : `${d.ns}/6 active`}</Badge>
        </div>
      </div>
      <div className="mt-1.5 flex gap-2">
        {d.st.map((s, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-[10px] border p-2.5 text-center",
              s.spray ? "border-[#bfe6d0] bg-brand-bg" : "border-[#f1cdc2] bg-coral-bg",
              s.amb && "shadow-[inset_0_0_0_2px_#ef8a3c]"
            )}
          >
            <div className="text-[11px] font-semibold text-mut">N{i + 1}</div>
            <div className={cn("mt-0.5 text-[12px] font-bold", s.spray ? "text-brand-dark" : "text-coral-dark")}>
              {s.spray ? "SPRAY" : s.tree ? "TREE" : "OFF"}
            </div>
            <div className="mt-0.5 text-[10.5px] text-mut">{s.clear.toFixed(1)} m</div>
            <div className="mt-px text-[9px] uppercase tracking-wide text-mut">
              crop {s.cropId}
              {s.amb ? "?" : ""}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-mut">
        <span>south · safe (field interior)</span>
        <span>north · organic boundary →</span>
      </div>
    </Card>
  );
}
