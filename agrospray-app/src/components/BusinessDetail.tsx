import { useSim, total } from "@/state/sim";
import { VALUE_M2, FINE } from "@/lib/engine";
import { Modal } from "./ui/modal";

const FIELD_HA = 12.8; // crop area of this run (~400 x 320 m)
const BOUNDARY_FINE = 50000;

function Line({ k, v, c }: { k: string; v: string; c?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-1.5 text-[13px] last:border-0">
      <span className="text-mut">{k}</span>
      <span className="font-mono font-semibold" style={{ color: c }}>{v}</span>
    </div>
  );
}

export function BusinessDetail({ k, onClose }: { k: string; onClose: () => void }) {
  const { series } = useSim();
  const tot1 = total(series["1m"].area),
    tot5 = total(series["5m"].area);
  const reclaimed = Math.max(0, tot1 - tot5);
  const amb5 = total(series["5m"].amb),
    amb1 = total(series["1m"].amb);
  const lit1 = total(series["1m"].lit),
    lit5 = total(series["5m"].lit);
  const liab = reclaimed * VALUE_M2;

  if (k === "value") {
    return (
      <Modal title="Value preserved — how it is computed" sub="Every figure traces to the per-fix decision log (no black box)." onClose={onClose}>
        <div className="space-y-1">
          <Line k="Border reclaimed vs 5 m (this run)" v={`${reclaimed.toFixed(0)} m²`} c="#1f7a4d" />
          <Line k="× crop gross margin" v={`€${VALUE_M2.toFixed(2)} / m²`} />
          <Line k="= border value recovered / application" v={`€${liab.toFixed(0)}`} c="#1f7a4d" />
          <Line k="Drift-fine exposure removed" v={`€${FINE.toLocaleString()} / incident`} c="#1f7a4d" />
          <Line k="Boundary fine avoided (organic overlap)" v={`€${BOUNDARY_FINE.toLocaleString()}`} c="#1f7a4d" />
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-mut">
          The €/m² is a conservative winter-wheat gross margin; the border is land that 5 m positioning forces you to leave untreated (a weed/pest reservoir) or to spray illegally. At 1 m the same border is sprayed safely, so its yield is recovered every application — plus the regulatory exposure (organic decertification, drift fines) is removed.
        </p>
      </Modal>
    );
  }

  if (k === "follow" || k === "ignore") {
    const follow = k === "follow";
    return (
      <Modal
        title={follow ? "Follow · 1 m precision" : "Ignore · 5 m coarse positioning"}
        sub={follow ? "What EWIA's metre-accuracy unlocks operationally." : "Why running on standard GNSS fails the necessity test."}
        onClose={onClose}
      >
        <div className="space-y-1">
          {follow ? (
            <>
              <Line k="Crop treated to the legal fence line" v={`${tot1.toFixed(0)} m²`} c="#1f7a4d" />
              <Line k="Border reclaimed vs 5 m" v={`+${reclaimed.toFixed(0)} m²`} c="#1f7a4d" />
              <Line k="Crop-ambiguous fixes (wrong dose)" v={`${amb1}`} c="#1f7a4d" />
              <Line k="Chemical placed on-target" v={`${lit1.toFixed(2)} L`} c="#1f7a4d" />
              <Line k="Boundary breaches" v="0" c="#1f7a4d" />
            </>
          ) : (
            <>
              <Line k="Border lost to forced setbacks" v={`-${reclaimed.toFixed(0)} m²`} c="#c84a35" />
              <Line k="Crop-ambiguous fixes (wrong dose / chemical)" v={`${amb5}`} c="#c84a35" />
              <Line k="Off-target chemical (soil waste)" v="zig-zag drift" c="#c84a35" />
              <Line k="Boundary overlap fine" v={`€${BOUNDARY_FINE.toLocaleString()} / incident`} c="#c84a35" />
              <Line k="Organic decertification exposure" v={`€${FINE.toLocaleString()}+`} c="#c84a35" />
            </>
          )}
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-mut">
          {follow
            ? "At 1 m the error radius is smaller than the gap to the organic line, so every nozzle can be proven clear: the boom sprays to the fence, the right chemical goes on the right crop, and the run is certifiable for automated profiles."
            : "At 5 m the error radius spans the 2–4 m gaps between parcels and the A|B crop seam. To stay legal the operator must cut the boom metres early (lost border) or spray anyway (off-target waste, wrong dose, and drift across the line — a €50,000 organic-overlap fine)."}
        </p>
      </Modal>
    );
  }

  if (k === "ambiguity") {
    return (
      <Modal title="Crop-ambiguous fixes" sub="When the receiver can't tell which crop it is over." onClose={onClose}>
        <div className="space-y-1">
          <Line k="Ambiguous fixes at 5 m" v={`${amb5}`} c="#c84a35" />
          <Line k="Ambiguous fixes at 1 m" v={`${amb1}`} c="#1f7a4d" />
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-mut">
          Crop A (wheat) and Crop B (rape) take different chemicals and doses. They share a seam only a few metres wide. When the 5 m error radius spans that seam the engine cannot prove which crop the nozzle is over — so the dose/chemical choice is a gamble (wrong-dose risk, agronomic damage, and wasted product). At 1 m the radius stays inside one crop, resolving the choice. This is a second, independent "flip" on the metre — exactly the rail-track ambiguity the challenge describes.
        </p>
      </Modal>
    );
  }

  if (k === "chemical") {
    return (
      <Modal title="Chemical placed on-target" sub="Precise dosing puts product on the plant, not the soil." onClose={onClose}>
        <div className="space-y-1">
          <Line k="On-target chemical at 1 m" v={`${lit1.toFixed(2)} L`} c="#1f7a4d" />
          <Line k="At 5 m (drift / mis-dose)" v={`${lit5.toFixed(2)} L`} c="#b5631f" />
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-mut">
          With 1 m precision the boom follows the crop row, so product lands on the plants at the correct dose for each crop. At 5 m the zig-zag drift sprays bare soil between rows (wasted chemical and money) and mis-doses across the crop seam. Less waste also means the tank lasts longer and more hectares are covered per refill.
        </p>
      </Modal>
    );
  }

  if (k === "fine") {
    return (
      <Modal title="Drift-fine exposure removed" sub="The compliance liability that 1 m positioning eliminates." onClose={onClose}>
        <div className="space-y-1">
          <Line k="Organic decertification (drift incident)" v={`€${FINE.toLocaleString()}+`} c="#c84a35" />
          <Line k="Boundary-overlap fine (per incident)" v={`€${BOUNDARY_FINE.toLocaleString()}`} c="#c84a35" />
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-mut">
          Under the EU Sustainable Use Regulation and German PflSchG, drift across a certified-organic boundary voids the neighbour's certification and triggers fines and liability. At 5 m the operator cannot prove the boom stayed clear, so this exposure ships with every job. At 1 m the decision is provable and the exposure is removed — which is the difference between a service that ships with a disclaimer and one that ships with a promise.
        </p>
      </Modal>
    );
  }

  // market / business potential
  const perFarmFields = 150,
    appsPerSeason = 3;
  const perFarmBorder = liab * perFarmFields * appsPerSeason;
  return (
    <Modal title="Business potential — could this be a venture?" sub="A horizontal: any drift-regulated spray context. Figures are conservative estimates." onClose={onClose}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-3">
          <div className="upper mb-1.5">Value per customer</div>
          <Line k="Border value / field / application" v={`€${liab.toFixed(0)}`} c="#1f7a4d" />
          <Line k="× ~150 fields × 3 applications / yr" v={`€${perFarmBorder.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} c="#1f7a4d" />
          <Line k="Decertification fines avoided" v={`€${FINE.toLocaleString()}+/incident`} c="#1f7a4d" />
        </div>
        <div className="rounded-xl border border-line p-3">
          <div className="upper mb-1.5">Model &amp; market</div>
          <Line k="Pricing (compliance-precision SaaS)" v="€20 / ha / yr" />
          <Line k="EU arable land" v="~105 M ha" />
          <Line k="Buffer-adjacent (organic/water/edge) ~15%" v="~15 M ha" />
          <Line k="Serviceable market @ €20/ha" v="~€300 M" c="#1f7a4d" />
        </div>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-mut">
        The wedge is <b>organic-adjacency compliance</b> — the job that is simply impossible to do safely at 5 m. The same engine maps to vineyards near watercourses, residential-edge orchards and rail-side vegetation control. Positioning is becoming a commodity input (like cloud compute a decade ago); the value moves to the vertical application that owns the underserved use case — exactly how ForeFlight (pilots) and Vakaros (sailing) monetised position. Figures are deliberately conservative and labelled as estimates.
      </p>
    </Modal>
  );
}
