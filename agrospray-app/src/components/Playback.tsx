import { useSim } from "@/state/sim";
import { PageHead } from "./PageHead";
import { Card } from "./ui/card";
import { cn } from "@/lib/utils";

export function Playback() {
  const { fix, maxFix, decision: d, setFix } = useSim();
  const steps = 6;
  const marks = Array.from({ length: steps }, (_, i) => Math.round((i / (steps - 1)) * maxFix));
  const state = d.kind === "ok" ? "SPRAYING" : d.kind === "warn" ? "PARTIAL CUT" : "BOOM OFF";

  return (
    <section>
      <PageHead module="Module 06 · Evaluation replay" title="Demo Playback" sub="Replay the flight across the real field map. Flip the receiver to watch the decision flip." />
      <Card>
        <div className="relative mx-1 my-2 flex justify-between">
          <div className="absolute left-0 right-0 top-[7px] h-0.5 bg-line" />
          {marks.map((fx, i) => (
            <button key={i} onClick={() => setFix(fx)} className="relative text-center text-[11px] text-mut">
              <div
                className={cn(
                  "mx-auto mb-1 h-[15px] w-[15px] rounded-full border-2 bg-white border-line",
                  fix >= fx && "border-brand bg-brand",
                  Math.abs(fix - fx) <= 10 && "border-ink bg-ink"
                )}
              />
              fix {fx}
            </button>
          ))}
        </div>
        <div className="mt-3.5 flex items-center gap-3">
          <span className="upper">Now</span>
          <div className="font-mono font-bold">{state}</div>
          <span className="flex-1" />
          <span className="text-[11.5px] text-mut">
            fix {fix} / {maxFix}
          </span>
        </div>
      </Card>
    </section>
  );
}
