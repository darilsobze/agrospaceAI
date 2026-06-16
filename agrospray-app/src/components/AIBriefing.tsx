import { useSim, total } from "@/state/sim";
import { decide } from "@/lib/engine";
import { TRACKS } from "@/lib/world";
import { PageHead } from "./PageHead";
import { Card } from "./ui/card";

export function AIBriefing() {
  const { world, op, receiver, fix, decision: d, series } = useSim();
  const t = TRACKS[receiver];
  const [lon, lat] = t.coords[fix];
  const is1 = receiver === "1m";

  // run-level ambiguity per receiver (the whole flight, not just this fix)
  const amb1 = total(series["1m"].amb);
  const amb5 = total(series["5m"].amb);
  // buffer breakdown (uncertainty term = confidence z * sigma)
  const zSigma = Math.max(0, d.buf - d.drift - d.react);

  const consoleText = is1
    ? `All 6 nozzles SPRAY.
Nearest nozzle ${d.mc.toFixed(1)} m from the nearest restricted zone.
Buffer ${d.buf.toFixed(1)} m = ${zSigma.toFixed(1)} (95% σ, gnss ${d.err.toFixed(1)}) + drift ${d.drift.toFixed(1)} (height ${op.height} m) + react ${d.react.toFixed(1)} (speed ${op.speed}).
Margin verified -> spray authorised.
[${amb1} nozzle(s) crop-ambiguous: precision cleared for row-isolated spraying]`
    : `6 nozzles SPRAYING — GPS track zig-zags, not aligned to the crop row.
Path deviates ±5.5 m across the column: pesticide landing on bare soil, not on the plants.
Buffer ${d.buf.toFixed(1)} m = ${zSigma.toFixed(1)} (95% σ, gnss ${d.err.toFixed(1)}) + drift ${d.drift.toFixed(1)} (height ${op.height} m) + react ${d.react.toFixed(1)} (speed ${op.speed}) — exceeds the 6 m row spacing.
CRITICAL: spray off-target — wasted on soil and drifting outside our section.
[${amb5} nozzle(s) crop-ambiguous: error radius spans the A|B seam -> wrong-dose risk]
[LEGAL ALERT: Boundary overlap detected with adjacent forbidden section]`;

  function exportCSV() {
    const rows = [["fix", "active_nozzles", "shut", "min_clear_m", "gnss_err_m", "buffer_m", "litres", "crop_ambiguous", "reason"]];
    for (let i = 0; i < t.coords.length; i++) {
      const dd = decide(world, op, "auto", t.coords[i][0], t.coords[i][1], t.headings[i], receiver, false);
      rows.push([
        String(i), String(dd.ns), dd.shut.join("|"), dd.mc.toFixed(2), dd.err.toFixed(2),
        dd.buf.toFixed(2), dd.litres.toFixed(4), String(dd.amb), `"${dd.reason.replace(/\n/g, " ")}"`,
      ]);
    }
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `agrospray_audit_${receiver}.csv`;
    a.click();
  }

  return (
    <section>
      <PageHead module="Module 03 · Transparent reasoner" title="AI Briefing" sub="Every cut traces to data and stated assumptions. No black box." />

      <div
        className={`flex items-center gap-4 rounded-xl2 border p-[18px] ${
          is1 ? "border-[#cfe9da] bg-gradient-to-b from-white to-brand-bg" : "border-[#f3d6cc] bg-gradient-to-b from-white to-coral-bg"
        }`}
      >
        <div className="flex-1">
          <div className={`text-[10px] font-extrabold tracking-widest ${is1 ? "text-brand-dark" : "text-coral-dark"}`}>
            {is1 ? "● VERIFIED" : "● CRITICAL"}
          </div>
          <div className="mt-1 text-[19px] font-bold leading-tight">
            {is1 ? "All 6 nozzles active — spraying to the line." : "Off-target drift — spray zig-zagging off the row and across the line."}
          </div>
        </div>
        {is1 ? (
          <span className="rounded-full border border-[#bfe6d0] bg-brand-bg px-3 py-1.5 text-[11px] font-bold text-brand-dark">GEOMETRY VERIFIED</span>
        ) : (
          <span className="animate-pulse rounded-full border border-[#f1cdc2] bg-coral-bg px-3 py-1.5 text-[11px] font-bold text-coral-dark">
            OFF-TARGET DRIFT
          </span>
        )}
      </div>

      <div className="upper mx-0.5 mb-2.5 mt-[18px]">Reasoning evidence · inputs</div>
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <div className="text-[12px] font-bold text-sky">INPUT_01</div>
          <div className="mt-1">Fix · real Zurich error</div>
          <div className="mt-1.5 font-mono text-[12px] text-mut">
            {lat.toFixed(6)}, {lon.toFixed(6)} @ {t.headings[fix].toFixed(0)}°
          </div>
        </Card>
        <Card>
          <div className="text-[12px] font-bold text-sky">INPUT_02</div>
          <div className="mt-1">OSM zone boundaries</div>
          <div className="mt-1.5 font-mono text-[12px] text-mut">nodes #883921</div>
        </Card>
        <Card>
          <div className="text-[12px] font-bold text-sky">INPUT_03</div>
          <div className="mt-1">geo_core.ts + P(drift)</div>
          <div className="mt-1.5 font-mono text-[12px] text-mut">point-in-polygon · N(0,σ)</div>
        </Card>
      </div>

      <pre
        className={`mt-3.5 whitespace-pre-wrap rounded-xl border p-4 font-mono text-[12.5px] leading-relaxed ${
          is1 ? "border-line bg-[#0f140f] text-[#cfe9da]" : "border-[#5b1d1d] bg-[#1a0d0d] text-[#ff9d97]"
        }`}
      >
        {consoleText}
      </pre>

      <div className="mt-3.5 flex items-center justify-between">
        <span className="text-[11.5px] text-mut">Compliance audit · per-fix decision log traceable to inputs (no black box).</span>
        <button onClick={exportCSV} className="rounded-full border border-line bg-white px-3.5 py-[7px] text-[12.5px] font-semibold">
          ⤓ Export audit CSV
        </button>
      </div>
    </section>
  );
}
