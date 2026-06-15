import { useSim } from "@/state/sim";
import { TANK } from "@/lib/engine";
import { PageHead } from "./PageHead";
import { Card } from "./ui/card";
import { Slider } from "./ui/slider";
import { Segmented } from "./ui/segmented";
import { Sparkline } from "./ui/sparkline";

export function FleetAirspace() {
  const { op, setOp, decision: d, receiver, fix, series } = useSim();
  const applied = series[receiver].lit[fix] ?? 0;
  const cost = series[receiver].cost[fix] ?? 0;
  const remain = Math.max(0, TANK - applied);

  return (
    <section>
      <PageHead module="Module 05 · Mission & environment" title="Fleet & Airspace" sub="Mission queue and the operating conditions that flex the safety buffer." />
      <div className="grid grid-cols-2 gap-3.5">
        <Card>
          <div className="upper">Flight &amp; spray controls</div>
          <div className="mt-2 space-y-3">
            <Slider label="Boom height" display={`${op.height.toFixed(1)} m`} value={op.height} min={1} max={8} step={0.5}
              onChange={(v) => setOp("height", v)} foot="Higher boom → more drift → wider safety margin." />
            <Slider label="Flight speed" display={`${op.speed.toFixed(1)} m/s`} value={op.speed} min={2} max={12} step={0.5}
              onChange={(v) => setOp("speed", v)} foot="Faster → longer valve-shut reaction distance added to the buffer." />
            <Slider label="Wind speed" display={`${op.wind.toFixed(1)} m/s`} value={op.wind} min={0} max={8} step={0.5}
              onChange={(v) => setOp("wind", v)} />
            <div className="flex items-center gap-2.5">
              <span className="whitespace-nowrap text-[11.5px] text-mut">Wind toward</span>
              <Segmented
                options={[
                  { value: "0", label: "N · organic" },
                  { value: "90", label: "E" },
                  { value: "180", label: "S" },
                  { value: "270", label: "W" },
                ]}
                value={String(op.wbear)}
                onChange={(v) => setOp("wbear", parseInt(v))}
                activeClass="bg-orange text-white"
              />
            </div>
            <div className="text-[11.5px] text-mut">Only nozzles downwind toward a restricted zone get the extra margin — asymmetric, graceful degradation.</div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="upper">Tank &amp; chemical</span>
            <Sparkline data={[3, 3.2, 4, 6, 8, 6.5, 5, op.wind + 0.1]} color="#ef8a3c" />
          </div>
          <div className="mt-2 font-mono text-[27px] font-bold">{remain.toFixed(2)} L</div>
          <div className="text-[11.5px] text-mut">chemical remaining · two crops, two doses</div>
          <div className="mt-2.5 h-[9px] overflow-hidden rounded-full bg-[#eef0ec]">
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-[#7fd0a0]" style={{ width: `${(remain / TANK) * 100}%` }} />
          </div>
          <div className="mt-3.5 flex justify-between">
            <div>
              <div className="upper">Applied</div>
              <div className="font-mono text-[16px] font-bold">{applied.toFixed(2)} L</div>
            </div>
            <div>
              <div className="upper">Cost</div>
              <div className="font-mono text-[16px] font-bold">€{cost.toFixed(2)}</div>
            </div>
            <div>
              <div className="upper">Active buffer</div>
              <div className="font-mono text-[16px] font-bold">{d.buf.toFixed(1)} m</div>
            </div>
          </div>
          <div className="mt-3 text-[11.5px] text-mut">
            Precise dosing puts the right chemical on the right crop — at 5 m the A|B seam is ambiguous, risking wrong-dose application.
          </div>
        </Card>
      </div>

      <Card className="mt-3.5">
        <div className="upper">Incoming flight queue</div>
        <table className="mt-2 w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-mut">
              <th className="border-b border-line p-2.5">Mission</th>
              <th className="border-b border-line p-2.5">Field</th>
              <th className="border-b border-line p-2.5">Restricted</th>
              <th className="border-b border-line p-2.5">Tank</th>
              <th className="border-b border-line p-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-b border-[#eef0ec] p-2.5 font-mono">AGZ-01</td>
              <td className="border-b border-[#eef0ec] p-2.5">Wheat + rape / organic edge</td>
              <td className="border-b border-[#eef0ec] p-2.5">organic, water, 2 trees</td>
              <td className="border-b border-[#eef0ec] p-2.5">{Math.round((remain / TANK) * 100)}%</td>
              <td className="border-b border-[#eef0ec] p-2.5">
                <span className="rounded-full bg-brand-bg px-2 py-0.5 text-[10.5px] font-bold text-brand-dark">ACTIVE</span>
              </td>
            </tr>
            <tr>
              <td className="border-b border-[#eef0ec] p-2.5 font-mono">AGZ-02</td>
              <td className="border-b border-[#eef0ec] p-2.5">Vineyard / water buffer</td>
              <td className="border-b border-[#eef0ec] p-2.5">watercourse</td>
              <td className="border-b border-[#eef0ec] p-2.5">100%</td>
              <td className="border-b border-[#eef0ec] p-2.5">
                <span className="rounded-full bg-[#eef0ec] px-2 py-0.5 text-[10.5px] font-bold text-mut">QUEUED</span>
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
    </section>
  );
}
