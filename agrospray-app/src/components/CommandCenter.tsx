import { useSim } from "@/state/sim";
import { BASE, VALUE_M2 } from "@/lib/engine";
import { PageHead } from "./PageHead";
import { KpiCard } from "./ui/card";
import { Sparkline } from "./ui/sparkline";
import { BoomStrip } from "./BoomStrip";
import { MiniMap } from "./MiniMap";
import { FleetDashboard } from "./FleetDashboard";
import type { Tab } from "./TopNav";

export function CommandCenter({ setTab }: { setTab: (t: Tab) => void }) {
  const { decision: d, receiver, fix, series } = useSim();
  const is1 = receiver === "1m";
  const reclaimed = Math.max(0, (series["1m"].area[fix] ?? 0) - (series["5m"].area[fix] ?? 0));
  const liab = reclaimed * VALUE_M2;
  const tag = d.kind === "ok" ? "● SPRAYING" : d.kind === "warn" ? "● BORDER APPROACH" : "● CRITICAL";
  const big =
    d.kind === "ok"
      ? "All 6 nozzles active — spraying to the line."
      : d.kind === "warn"
      ? `Disabling nozzle(s) ${d.shut.join(" & ")} to protect a restricted zone.`
      : "Full boom cut — position cannot prove zero drift.";
  const clearSeg = series[receiver].clear.slice(Math.max(0, fix - 60), fix + 1);

  return (
    <section>
      <PageHead module="Module 01 · Operational cockpit" title="Command Center" sub="Live boom-control decision from the drone's position and its uncertainty." />

      <div
        className={`flex items-center gap-4 rounded-xl2 border p-[18px] ${
          d.kind === "ok" ? "border-[#cfe9da] bg-gradient-to-b from-white to-brand-bg" : "border-[#f3d6cc] bg-gradient-to-b from-white to-coral-bg"
        }`}
      >
        <div className="flex-1">
          <div className={`text-[10px] font-extrabold tracking-widest ${d.kind === "ok" ? "text-brand-dark" : "text-coral-dark"}`}>{tag}</div>
          <div className="mt-1 text-[19px] font-bold leading-tight">{big}</div>
          <div className="mt-1 text-[12.5px] text-mut">
            Why: nearest nozzle {d.mc.toFixed(1)} m vs {d.buf.toFixed(1)} m buffer (gnss {d.err.toFixed(1)} + drift {d.drift.toFixed(1)} + react{" "}
            {d.react.toFixed(1)}){d.amb ? ` · ${d.amb} crop-ambiguous` : ""}.
          </div>
        </div>
        <div className="text-right">
          <div className="upper">Liability avoided</div>
          <div className="font-mono text-[21px] font-bold text-brand-dark">€{liab.toFixed(0)}+</div>
        </div>
        <button onClick={() => setTab("briefing")} className="rounded-full border border-line bg-white px-4 py-2 font-semibold">
          Reasoning →
        </button>
      </div>

      <div className="mt-3.5 grid grid-cols-4 gap-3.5">
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
        <KpiCard label="Border reclaimed" value={`${reclaimed.toFixed(0)} m²`} tone="green" foot="vs 5 m baseline, this run" />
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
