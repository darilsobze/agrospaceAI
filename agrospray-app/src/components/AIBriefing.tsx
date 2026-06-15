import { useSim } from "@/state/sim";
import { decide } from "@/lib/engine";
import { TRACKS } from "@/lib/world";
import { PageHead } from "./PageHead";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

export function AIBriefing() {
  const { world, op, receiver, fix, decision: d } = useSim();
  const t = TRACKS[receiver];
  const [lon, lat] = t.coords[fix];
  const tag = d.kind === "ok" ? "● SPRAYING" : d.kind === "warn" ? "● BORDER APPROACH" : "● CRITICAL";

  function exportCSV() {
    const rows = [["fix", "active_nozzles", "shut", "min_clear_m", "gnss_err_m", "buffer_m", "litres", "crop_ambiguous", "reason"]];
    for (let i = 0; i < t.coords.length; i++) {
      const dd = decide(world, op, "auto", t.coords[i][0], t.coords[i][1], t.headings[i], receiver, false);
      rows.push([
        String(i),
        String(dd.ns),
        dd.shut.join("|"),
        dd.mc.toFixed(2),
        dd.err.toFixed(2),
        dd.buf.toFixed(2),
        dd.litres.toFixed(4),
        String(dd.amb),
        `"${dd.reason.replace(/\n/g, " ")}"`,
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
          d.kind === "ok" ? "border-[#cfe9da] bg-gradient-to-b from-white to-brand-bg" : "border-[#f3d6cc] bg-gradient-to-b from-white to-coral-bg"
        }`}
      >
        <div className="flex-1">
          <div className={`text-[10px] font-extrabold tracking-widest ${d.kind === "ok" ? "text-brand-dark" : "text-coral-dark"}`}>{tag}</div>
          <div className="mt-1 text-[19px] font-bold leading-tight">
            {d.kind === "ok" ? "All 6 nozzles active." : d.kind === "warn" ? `Nozzles ${d.shut.join(" & ")} held closed.` : "Full boom cut."}
          </div>
        </div>
        <Badge tone={d.kind === "ok" ? "green" : d.kind === "warn" ? "orange" : "coral"}>
          {d.kind === "ok" ? "GEOMETRY VERIFIED" : d.kind === "warn" ? "BUFFER BREACH" : "POSITION UNSAFE"}
        </Badge>
      </div>

      <div className="upper mx-0.5 mb-2.5 mt-[18px]">Reasoning evidence · inputs</div>
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <div className="text-[12px] font-bold text-sky">INPUT_01</div>
          <div className="mt-1">Live NMEA fix</div>
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
          <div className="mt-1">geo_core.ts geometry</div>
          <div className="mt-1.5 font-mono text-[12px] text-mut">point-in-polygon + edge dist</div>
        </Card>
      </div>

      <pre className="mt-3.5 whitespace-pre-wrap rounded-xl border border-line bg-[#0f140f] p-4 font-mono text-[12.5px] leading-relaxed text-[#cfe9da]">
        {d.reason}
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
