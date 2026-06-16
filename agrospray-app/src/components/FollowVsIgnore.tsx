import { useState } from "react";
import { useSim, total } from "@/state/sim";
import { FINE, VALUE_M2 } from "@/lib/engine";
import { PageHead } from "./PageHead";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { BusinessDetail } from "./BusinessDetail";
import { Maximize2, TrendingUp } from "lucide-react";

function BarRow({ label, a, b, unit, betterHigh = true }: { label: string; a: number; b: number; unit: string; betterHigh?: boolean }) {
  const max = Math.max(a, b, 1);
  const fmt = (x: number) => (unit === "L" ? x.toFixed(1) : x.toFixed(0));
  return (
    <div className="py-1.5">
      <div className="mb-1 flex justify-between text-[11.5px]">
        <span className="text-mut">{label}</span>
        <span className="font-mono text-mut">
          1 m <b className="text-brand-dark">{fmt(a)}</b> · 5 m <b className="text-coral-dark">{fmt(b)}</b> {unit}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#eef0ec]">
          <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${(a / max) * 100}%` }} />
        </div>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#eef0ec]">
          <div className="h-full rounded-full bg-coral transition-all duration-500" style={{ width: `${(b / max) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

export function FollowVsIgnore() {
  const { fix, series } = useSim();
  const [open, setOpen] = useState<string | null>(null);
  const reclaimed = Math.max(0, (series["1m"].area[fix] ?? 0) - (series["5m"].area[fix] ?? 0));
  const liab = reclaimed * VALUE_M2;
  const tot1 = total(series["1m"].area),
    tot5 = total(series["5m"].area);
  const diff = tot1 - tot5;
  const amb5 = total(series["5m"].amb),
    amb1 = total(series["1m"].amb);
  const lit1 = total(series["1m"].lit),
    lit5 = total(series["5m"].lit);

  return (
    <section>
      <PageHead module="Module 04 · Business case" title="Cost saving" sub="What 1 m precision unlocks against running on coarse 5 m positioning. Click any card for the breakdown." />

      {/* value preserved hero — clickable */}
      <button onClick={() => setOpen("value")} className="group w-full rounded-xl2 border border-line bg-card p-4 text-left transition-colors hover:border-brand">
        <div className="flex items-center justify-between">
          <span className="upper">Value preserved · this field, this run</span>
          <Maximize2 size={14} className="text-mut opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <div className="font-mono text-[40px] font-bold tracking-tighter text-brand-dark">
          €{liab.toFixed(0)} + €{FINE.toLocaleString()} risk
        </div>
        <div className="text-[11.5px] text-mut">{reclaimed.toFixed(0)} m² of legal border reclaimed so far · drift-fine exposure removed · click for the maths</div>
      </button>

      {/* comparison bars */}
      <Card className="mt-3.5">
        <div className="upper mb-1">1 m vs 5 m · whole run</div>
        <BarRow label="Crop treated (to the line)" a={tot1} b={tot5} unit="m²" />
        <BarRow label="Crop-ambiguous fixes (wrong dose)" a={amb1} b={amb5} unit="" />
        <BarRow label="Chemical placed on-target" a={lit1} b={lit5} unit="L" />
      </Card>

      {/* path cards — clickable */}
      <div className="mt-3.5 grid grid-cols-2 gap-3.5">
        <button onClick={() => setOpen("follow")} className="group rounded-xl2 border border-[#cfe9da] bg-gradient-to-b from-white to-brand-bg p-4 text-left transition-shadow hover:shadow-float">
          <Badge tone="green" className="float-right">OPTIMAL PATH</Badge>
          <h4 className="mb-1 text-[15px] font-bold text-brand-dark">Follow · 1 m precision</h4>
          <div className="text-[13px] text-mut">Spray to the fence, right chemical to the right crop.</div>
          <ul className="mt-2.5 list-disc pl-[18px] text-[13px] leading-relaxed text-[#444]">
            <li>{diff.toFixed(0)} m² more crop treated than at 5 m</li>
            <li>{amb1} crop-ambiguous nozzles → correct dose</li>
            <li>Full compliance for automated profiles</li>
          </ul>
          <div className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-brand-dark">Details <Maximize2 size={12} /></div>
        </button>
        <button onClick={() => setOpen("ignore")} className="group rounded-xl2 border border-[#f1cdc2] bg-gradient-to-b from-white to-coral-bg p-4 text-left transition-shadow hover:shadow-float">
          <Badge tone="coral" className="float-right">OPERATIONAL RISK</Badge>
          <h4 className="mb-1 text-[15px] font-bold text-coral-dark">Ignore · 5 m coarse</h4>
          <div className="text-[13px] text-mut">Forced setbacks, drift, wrong dose, fines.</div>
          <ul className="mt-2.5 list-disc pl-[18px] text-[13px] leading-relaxed text-[#444]">
            <li>{diff.toFixed(0)} m² of border lost to forced setbacks</li>
            <li>{amb5} crop-ambiguous fixes → wrong-dose risk</li>
            <li>€50,000 boundary fine on organic overlap</li>
          </ul>
          <div className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-coral-dark">Details <Maximize2 size={12} /></div>
        </button>
      </div>

      {/* clickable KPIs */}
      <div className="mt-3.5 grid grid-cols-3 gap-3.5">
        {[
          { k: "ambiguity", l: "Crop-ambiguous fixes", v: `${amb5}`, tone: "coral", foot: "5 m can't tell A from B → click" },
          { k: "chemical", l: "Chemical on-target", v: `${lit1.toFixed(1)} L`, tone: "green", foot: "correct dose, correct crop → click" },
          { k: "fine", l: "Drift-fine exposure removed", v: `€${FINE.toLocaleString()}`, tone: "green", foot: "per avoided incident → click" },
        ].map((c) => (
          <button key={c.k} onClick={() => setOpen(c.k)} className="group rounded-xl2 border border-line bg-card p-4 text-left transition-colors hover:border-mut">
            <div className="flex items-center justify-between">
              <span className="upper">{c.l}</span>
              <Maximize2 size={12} className="text-mut opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className={`mt-2 text-[27px] font-bold tracking-tight ${c.tone === "coral" ? "text-coral-dark" : "text-brand-dark"}`}>{c.v}</div>
            <div className="mt-1 text-[11.5px] text-mut">{c.foot}</div>
          </button>
        ))}
      </div>

      {/* business potential — clickable */}
      <button onClick={() => setOpen("market")} className="group mt-3.5 flex w-full items-center gap-3 rounded-xl2 border border-line bg-gradient-to-r from-brand-bg to-white p-4 text-left transition-colors hover:border-brand">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white"><TrendingUp size={20} /></div>
        <div className="flex-1">
          <div className="text-[14px] font-bold">Could this be a venture? · Business potential</div>
          <div className="text-[12.5px] text-mut">Per-field value scales to ~€300 M serviceable market — the organic-adjacency wedge. Click for the model.</div>
        </div>
        <Maximize2 size={14} className="text-mut opacity-0 transition-opacity group-hover:opacity-100" />
      </button>

      {open && <BusinessDetail k={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
