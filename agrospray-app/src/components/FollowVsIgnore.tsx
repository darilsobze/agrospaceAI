import { useSim, total } from "@/state/sim";
import { FINE, VALUE_M2 } from "@/lib/engine";
import { PageHead } from "./PageHead";
import { Card, KpiCard } from "./ui/card";
import { Badge } from "./ui/badge";

export function FollowVsIgnore() {
  const { fix, series } = useSim();
  const reclaimed = Math.max(0, (series["1m"].area[fix] ?? 0) - (series["5m"].area[fix] ?? 0));
  const liab = reclaimed * VALUE_M2;
  const tot1 = total(series["1m"].area),
    tot5 = total(series["5m"].area);
  const diff = tot1 - tot5;
  const amb5 = total(series["5m"].amb);
  const lit1 = total(series["1m"].lit);

  return (
    <section>
      <PageHead module="Module 04 · Business case" title="Follow vs Ignore" sub="What 1 m precision unlocks against running on coarse 5 m positioning." />
      <Card>
        <div className="upper">Value preserved · this field, this run</div>
        <div className="font-mono text-[40px] font-bold tracking-tighter text-brand-dark">
          €{liab.toFixed(0)} + €{FINE.toLocaleString()} risk
        </div>
        <div className="text-[11.5px] text-mut">
          {reclaimed.toFixed(0)} m² of legal border reclaimed so far · drift-fine exposure removed per avoided incident
        </div>
      </Card>

      <div className="mt-3.5 grid grid-cols-2 gap-3.5">
        <Card className="border-[#cfe9da] bg-gradient-to-b from-white to-brand-bg">
          <Badge tone="green" className="float-right">
            OPTIMAL PATH
          </Badge>
          <h4 className="mb-1 text-[15px] font-bold text-brand-dark">Follow · 1 m precision</h4>
          <div className="text-[13px] text-mut">Spray to the legal fence line, right chemical to the right crop.</div>
          <ul className="mt-2.5 list-disc pl-[18px] text-[13px] leading-relaxed text-[#444]">
            <li>{diff.toFixed(0)} m² more crop treated than at 5 m</li>
            <li>Zero crop-ambiguous nozzles → correct dose</li>
            <li>Full compliance for automated profiles</li>
          </ul>
        </Card>
        <Card className="border-[#f1cdc2] bg-gradient-to-b from-white to-coral-bg">
          <Badge tone="coral" className="float-right">
            OPERATIONAL RISK
          </Badge>
          <h4 className="mb-1 text-[15px] font-bold text-coral-dark">Ignore · 5 m coarse</h4>
          <div className="text-[13px] text-mut">Forced manual setbacks, drift, or wrong dose.</div>
          <ul className="mt-2.5 list-disc pl-[18px] text-[13px] leading-relaxed text-[#444]">
            <li>{diff.toFixed(0)} m² of border lost to forced setbacks</li>
            <li>{amb5} crop-ambiguous fixes → wrong-dose / wrong-chemical risk</li>
            <li>Organic decertification + drift fines</li>
          </ul>
        </Card>
      </div>

      <div className="mt-3.5 grid grid-cols-3 gap-3.5">
        <KpiCard label="Crop-ambiguous fixes" value={`${amb5}`} tone="coral" foot="5 m can't tell crop A from B → 0 at 1 m" />
        <KpiCard label="Chemical placed on-target" value={`${lit1.toFixed(2)} L`} tone="green" foot="correct dose, correct crop" />
        <KpiCard label="Drift-fine exposure removed" value="€5,000" tone="green" foot="per avoided organic-decert incident" />
      </div>
    </section>
  );
}
