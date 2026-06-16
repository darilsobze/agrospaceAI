import { useSim } from "@/state/sim";
import { BASE, TANK, VALUE_M2 } from "@/lib/engine";
import { PageHead } from "./PageHead";
import { KpiCard } from "./ui/card";
import { Sparkline } from "./ui/sparkline";
import { BoomStrip } from "./BoomStrip";
import { MiniMap } from "./MiniMap";
import { FleetDashboard } from "./FleetDashboard";
import type { Tab } from "./TopNav";

export function CommandCenter({ setTab }: { setTab: (t: Tab) => void }) {
  const { decision: d, receiver, fix, series, op } = useSim();
  const is1 = receiver === "1m";
  const reclaimed = Math.max(0, (series["1m"].area[fix] ?? 0) - (series["5m"].area[fix] ?? 0));
  const liab = reclaimed * VALUE_M2;
  const nearBoundary = d.mc < 10; // a nozzle is within 10 m of the organic line (top)
  const tag = is1
    ? d.kind === "ok"
      ? "● SPRAYING"
      : d.kind === "warn"
      ? "● BORDER APPROACH"
      : "● CRITICAL"
    : nearBoundary
    ? "● OUT OF SECTION"
    : "● ZIG-ZAG DRIFT";
  const big = is1
    ? "All 6 nozzles active — spraying to the line."
    : nearBoundary
    ? "Spraying OUT OF SECTION — drift onto the neighbour's parcel. €50,000 fine incurred."
    : "Spraying ZIG-ZAG — off the crop row, wasted on bare soil.";
  const clearSeg = series[receiver].clear.slice(Math.max(0, fix - 60), fix + 1);
  const remaining = Math.max(0, TANK - (series[receiver].lit[fix] ?? 0));

  return (
    <section>
      <PageHead module="Module 01 · Operational cockpit" title="Command Center" sub="Live boom-control decision from the drone's position and its uncertainty." />

      <div
        className={`flex items-center gap-4 rounded-xl2 border p-[18px] ${
          is1 ? "border-[#cfe9da] bg-gradient-to-b from-white to-brand-bg" : "border-[#f3d6cc] bg-gradient-to-b from-white to-coral-bg"
        }`}
      >
        <div className="flex-1">
          <div className={`text-[10px] font-extrabold tracking-widest ${is1 ? "text-brand-dark" : "text-coral-dark"} ${is1 ? "" : "animate-pulse"}`}>{tag}</div>
          <div className="mt-1 text-[19px] font-bold leading-tight">{big}</div>
          <div className="mt-1 text-[12.5px] text-mut">
            Why: worst nozzle P(drift across line) {(Math.max(...d.st.map((s) => s.p)) * 100).toFixed(1)}% vs {(op.risk * 100).toFixed(0)}% risk · σ={d.err.toFixed(1)} m
            {d.amb ? ` · ${d.amb} crop-ambiguous` : ""}.
          </div>
        </div>
        {is1 ? (
          <div className="text-right">
            <div className="upper">Liability avoided</div>
            <div className="font-mono text-[21px] font-bold text-brand-dark">€{liab.toFixed(0)}+</div>
          </div>
        ) : nearBoundary ? (
          <div className="text-right">
            <div className="upper">Boundary fine</div>
            <div className="font-mono text-[21px] font-bold text-coral-dark">€50,000</div>
          </div>
        ) : (
          <div className="text-right">
            <div className="upper">Drift exposure</div>
            <div className="font-mono text-[21px] font-bold text-coral-dark">€5,000 risk</div>
          </div>
        )}
        <button onClick={() => setTab("briefing")} className="rounded-full border border-line bg-white px-4 py-2 font-semibold">
          Reasoning →
        </button>
      </div>

      <div className="mt-3.5 grid grid-cols-5 gap-3.5">
        <KpiCard
          label="Live precision"
          value={is1 ? `${d.err.toFixed(2)} m` : `${d.err.toFixed(1)} m`}
          tone={is1 ? "green" : "orange"}
          foot={d.err > BASE[receiver] + 0.05 ? "inflated near tree (multipath)" : is1 ? "Galileo HAS · corrected" : "uncorrected · standard"}
          right={<Sparkline data={clearSeg.map(() => d.err)} color="#5b8def" />}
        />
        <KpiCard
          label="Boundary clearance"
          value={`${d.mc.toFixed(1)} m`}
          tone={d.mc < d.buf ? "coral" : "green"}
          foot="nearest nozzle → restricted zone"
          right={<Sparkline data={clearSeg} color="#2f9e63" />}
        />
        <KpiCard label="Boom state" value={`${d.ns}/6`} tone={d.ns === 6 ? "green" : d.ns === 0 ? "coral" : "orange"} foot="nozzles spraying" />
        <KpiCard label="Wind speed" value={`${op.wind.toFixed(1)} m/s`} tone={op.wind > 0 ? "orange" : "green"} foot="downwind inflates the buffer" />
        <KpiCard label="Tank chemical" value={`${remaining.toFixed(2)} L`} tone={remaining < TANK * 0.15 ? "coral" : "green"} foot={`remaining of ${TANK} L`} />
      </div>

      <BoomStrip />

      <FleetDashboard />

      <div className="mx-0.5 mb-0 mt-[22px]">
        <div className="upper">Field digital twin · live position + error radius</div>
      </div>
      <div className="mt-1.5">
        <MiniMap height={320} />
      </div>
    </section>
  );
}
