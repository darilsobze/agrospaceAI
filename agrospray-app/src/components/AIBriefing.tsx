import { useState } from "react";
import { useSim, total } from "@/state/sim";
import { decide } from "@/lib/engine";
import { TRACKS } from "@/lib/world";
import { PageHead } from "./PageHead";
import { Card } from "./ui/card";
import { InputDetail } from "./InputDetail";
import { Activity, Cpu, Download, Maximize2, MapPinned, Satellite, ShieldAlert, ShieldCheck } from "lucide-react";

export function AIBriefing() {
  const { world, op, receiver, fix, decision: d, series } = useSim();
  const [openInput, setOpenInput] = useState<number | null>(null);
  const t = TRACKS[receiver];
  const [lon, lat] = t.coords[fix];
  const is1 = receiver === "1m";

  const amb1 = total(series["1m"].amb);
  const amb5 = total(series["5m"].amb);
  const zSigma = Math.max(0, d.buf - d.drift - d.react);
  const worstP = Math.max(...d.st.map((s) => s.p));
  const conf = Math.round((1 - op.risk) * 100);

  const consoleText = is1
    ? `All 6 nozzles SPRAY.
Nearest nozzle ${d.mc.toFixed(1)} m from the nearest restricted zone.
Buffer ${d.buf.toFixed(1)} m = ${zSigma.toFixed(1)} (95% σ, gnss ${d.err.toFixed(1)}) + drift ${d.drift.toFixed(1)} (height ${op.height} m) + react ${d.react.toFixed(1)} (speed ${op.speed}).
Margin verified -> spray authorised.
[${amb1} nozzle(s) crop-ambiguous: precision cleared for row-isolated spraying]`
    : `6 nozzles SPRAYING — GPS track zig-zags, not aligned to the crop row.
Path deviates ±5.5 m across the column: pesticide landing on bare soil, not on the plants.
Buffer ${d.buf.toFixed(1)} m = ${zSigma.toFixed(1)} (95% σ, gnss ${d.err.toFixed(1)}) + drift ${d.drift.toFixed(1)} (height ${op.height} m) + react ${d.react.toFixed(1)} (speed ${op.speed}).
CRITICAL: spray off-target — wasted on soil and drifting outside our section.
[${amb5} nozzle(s) crop-ambiguous: error radius spans the A|B seam -> wrong-dose risk]
[LEGAL ALERT: Boundary overlap with neighbour's forbidden section -> €50,000 fine per incident]`;

  function exportCSV() {
    const rows = [["fix", "active_nozzles", "shut", "min_clear_m", "gnss_err_m", "buffer_m", "litres", "crop_ambiguous", "reason"]];
    for (let i = 0; i < t.coords.length; i++) {
      const dd = decide(world, op, "auto", t.coords[i][0], t.coords[i][1], t.headings[i], receiver, false);
      rows.push([String(i), String(dd.ns), dd.shut.join("|"), dd.mc.toFixed(2), dd.err.toFixed(2), dd.buf.toFixed(2), dd.litres.toFixed(4), String(dd.amb), `"${dd.reason.replace(/\n/g, " ")}"`]);
    }
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `agrospray_audit_${receiver}.csv`;
    a.click();
  }

  const riskPct = op.risk * 100;
  const pPct = Math.min(100, worstP * 100);

  return (
    <section>
      <PageHead module="Module 03 · Transparent reasoner" title="AI Briefing" sub="Every cut traces to data and stated assumptions. No black box." />

      {/* verdict header */}
      <div className={`flex items-center gap-4 rounded-xl2 border p-[18px] ${is1 ? "border-[#cfe9da] bg-gradient-to-r from-brand-bg to-white" : "border-[#f3d6cc] bg-gradient-to-r from-coral-bg to-white"}`}>
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${is1 ? "bg-brand text-white" : "animate-pulse bg-coral text-white"}`}>
          {is1 ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
        </div>
        <div className="flex-1">
          <div className={`text-[10px] font-extrabold tracking-widest ${is1 ? "text-brand-dark" : "text-coral-dark"}`}>{is1 ? "● VERIFIED" : "● CRITICAL"}</div>
          <div className="text-[19px] font-bold leading-tight">{is1 ? "All 6 nozzles active — spraying to the line." : "Off-target drift — spray zig-zagging off the row and across the line."}</div>
        </div>
        <span className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-bold ${is1 ? "border-[#bfe6d0] bg-brand-bg text-brand-dark" : "animate-pulse border-[#f1cdc2] bg-coral-bg text-coral-dark"}`}>
          {is1 ? "GEOMETRY VERIFIED" : "OFF-TARGET DRIFT"}
        </span>
      </div>

      {/* terminal + live telemetry */}
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        {/* terminal window */}
        <div className={`overflow-hidden rounded-xl2 border ${is1 ? "border-[#1d2a1d]" : "border-[#5b1d1d]"}`}>
          <div className={`flex items-center gap-2 px-3 py-2 text-[11px] font-mono ${is1 ? "bg-[#0f140f] text-[#7e8c7e]" : "bg-[#1a0d0d] text-[#a88]"}`}>
            <span className="h-2.5 w-2.5 rounded-full bg-[#e8654f]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#f2b705]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#2f9e63]" />
            <span className="ml-2">agrospray://decision-log · fix {fix}</span>
            <span className="ml-auto flex items-center gap-1"><Activity size={12} /> live</span>
          </div>
          <div className={`px-4 py-3 font-mono text-[12.5px] leading-relaxed ${is1 ? "bg-[#0f140f]" : "bg-[#1a0d0d]"}`}>
            {consoleText.split("\n").map((line, i) => {
              const bad = /CRITICAL|LEGAL ALERT|SHUT DOWN|zig-zag|off-target|wasted|wrong-dose|drifting/i.test(line);
              const good = /verified|authorised|cleared/i.test(line);
              return (
                <div key={i} className={bad ? "text-[#ff9d97]" : good ? "text-[#7ee2a0]" : is1 ? "text-[#cfe9da]" : "text-[#e7c3bf]"}>
                  {line}
                </div>
              );
            })}
            <span className="animate-pulse text-[#7ee2a0]">▋</span>
          </div>
        </div>

        {/* live telemetry */}
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="upper">Live telemetry</span>
            <span className="text-[11px] text-mut">{conf}% confidence</span>
          </div>
          {/* probability bar */}
          <div>
            <div className="mb-1 flex justify-between text-[11.5px]">
              <span className="text-mut">P(drift across line)</span>
              <span className="font-mono font-bold" style={{ color: worstP > op.risk ? "#c84a35" : "#1f7a4d" }}>{pPct.toFixed(pPct < 10 ? 1 : 0)}%</span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-[#eef0ec]">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(2, pPct)}%`, background: worstP > op.risk ? "linear-gradient(90deg,#ef8a3c,#e8654f)" : "linear-gradient(90deg,#2f9e63,#7fd0a0)" }} />
              <div className="absolute top-[-2px] h-[14px] w-[2px] bg-ink" style={{ left: `${riskPct}%` }} title={`risk ${riskPct}%`} />
            </div>
            <div className="mt-1 text-[10.5px] text-mut">vertical marker = {riskPct}% risk threshold</div>
          </div>
          {/* mini stats */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { l: "Nearest clearance", v: `${d.mc.toFixed(1)} m`, c: d.mc < d.buf ? "#c84a35" : "#1f7a4d" },
              { l: "Active nozzles", v: `${d.ns}/6`, c: d.ns === 6 ? "#1f7a4d" : d.ns === 0 ? "#c84a35" : "#b5631f" },
              { l: "GNSS σ", v: `${d.err.toFixed(2)} m`, c: is1 ? "#1f7a4d" : "#b5631f" },
              { l: "Buffer", v: `${d.buf.toFixed(1)} m`, c: "#1b211b" },
            ].map((s) => (
              <div key={s.l} className="rounded-lg border border-line px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wide text-mut">{s.l}</div>
                <div className="font-mono text-[16px] font-bold" style={{ color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* per-nozzle decision chips */}
      <div className="mt-3.5 rounded-xl2 border border-line bg-card p-3">
        <div className="upper mb-2">Per-nozzle decision · P(drift)</div>
        <div className="flex gap-2">
          {d.st.map((s, i) => (
            <div key={i} className={`flex-1 rounded-lg border px-2 py-2 text-center ${s.spray ? "border-[#bfe6d0] bg-brand-bg" : "border-[#f1cdc2] bg-coral-bg"}`}>
              <div className="text-[10px] font-semibold text-mut">N{i + 1}</div>
              <div className={`text-[12px] font-bold ${s.spray ? "text-brand-dark" : "text-coral-dark"}`}>{s.spray ? "SPRAY" : s.tree ? "TREE" : "CUT"}</div>
              <div className="font-mono text-[10px]" style={{ color: s.p > op.risk ? "#c84a35" : "#1f7a4d" }}>{(s.p * 100).toFixed(s.p < 0.1 ? 1 : 0)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* live data inputs */}
      <div className="upper mx-0.5 mb-2 mt-3.5">Reasoning evidence · live inputs · <span className="text-sky">click to inspect</span></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: <Satellite size={16} />, k: "INPUT_01", t: "Real Zurich GNSS fix", v: `${lat.toFixed(5)}, ${lon.toFixed(5)} @ ${t.headings[fix].toFixed(0)}°` },
          { icon: <MapPinned size={16} />, k: "INPUT_02", t: "OSM zone boundaries", v: `${world.crops.length} crops · ${world.restricted.length} zones` },
          { icon: <Cpu size={16} />, k: "INPUT_03", t: "geo_core + P(drift) N(0,σ)", v: "point-in-polygon · normCdf" },
        ].map((c, i) => (
          <button key={c.k} onClick={() => setOpenInput(i)} className="group flex items-start gap-3 rounded-xl2 border border-line bg-card p-4 text-left transition-colors hover:border-sky">
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eef3ff] text-sky">{c.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-sky">
                {c.k}
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                <Maximize2 size={12} className="ml-auto text-mut opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="text-[13px]">{c.t}</div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-mut">{c.v}</div>
            </div>
          </button>
        ))}
      </div>

      {openInput !== null && <InputDetail index={openInput} onClose={() => setOpenInput(null)} />}

      <div className="mt-3.5 flex items-center justify-between">
        <span className="text-[11.5px] text-mut">Compliance audit · per-fix decision log traceable to inputs (no black box).</span>
        <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-[7px] text-[12.5px] font-semibold hover:border-mut">
          <Download size={14} /> Export audit CSV
        </button>
      </div>
    </section>
  );
}
