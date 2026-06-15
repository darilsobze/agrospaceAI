import { useSim } from "@/state/sim";
import { Pause, Play } from "lucide-react";

export function Transport() {
  const { fix, maxFix, playing, togglePlay, setFix } = useSim();
  return (
    <div className="sticky bottom-3.5 mt-[22px] flex items-center gap-3.5 rounded-full border border-line bg-card px-4 py-2.5 shadow-float">
      <button onClick={togglePlay} className="flex items-center gap-1.5 rounded-full border border-ink bg-ink px-4 py-2 font-bold text-white">
        {playing ? <Pause size={14} /> : <Play size={14} />}
        {playing ? "Pause" : "Play"}
      </button>
      <input type="range" min={0} max={maxFix} value={fix} onChange={(e) => setFix(parseInt(e.target.value))} className="flex-1" />
      <span className="font-mono text-[12px] text-mut">
        fix {fix} / {maxFix}
      </span>
    </div>
  );
}
