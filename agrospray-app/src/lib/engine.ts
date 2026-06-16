// AgroSpray AI decision engine — pure, typed, framework-free.
// Mirrors agrospray/engine.py. The safety buffer is the product:
//   buffer = gnss_error + drift_margin(height) + reaction(speed) + downwind(wind dir)
import { centroid, distM, distToPolygonEdge, mlon, M_LAT, pointInPolygon } from "./geo";
import type { Decision, Master, NozzleState, OperatorSettings, Receiver, World } from "./types";

export const BOOM = 12;
export const NN = 6;
export const VALUE_M2 = 0.18;
export const FINE = 5000;
export const TANK = 28.0;
export const BASE: Record<Receiver, number> = { "5m": 5.0, "1m": 1.0 };
const DRIFT_BASE = 0.5,
  K_HEIGHT = 0.3,
  K_WIND = 0.18;

export const OFFS = Array.from({ length: NN }, (_, i) => -BOOM / 2 + (BOOM * (i + 0.5)) / NN);
export const naFix = (op: OperatorSettings) => (BOOM / NN) * op.speed;

export function nozzlePositions(lon: number, lat: number, h: number): [number, number][] {
  const th = (h * Math.PI) / 180,
    pe = -Math.cos(th),
    pn = Math.sin(th);
  return OFFS.map((o) => [lon + (pe * o) / mlon(lat), lat + (pn * o) / M_LAT]);
}

export function gnssError(lon: number, lat: number, rec: Receiver, world: World): number {
  let e = BASE[rec];
  for (const o of world.obstacles) {
    const d = distM(lon, lat, o.lon, o.lat);
    if (d < o.rGps) e += BASE[rec] * 1.5 * (1 - d / o.rGps);
  }
  return e;
}
const gnssErr = gnssError;

function distRestricted(lon: number, lat: number, world: World) {
  let best = Infinity,
    zone = null as World["restricted"][number] | null;
  for (const r of world.restricted) {
    const d = pointInPolygon(lon, lat, r.ring) ? 0 : distToPolygonEdge(lon, lat, r.ring);
    if (d < best) {
      best = d;
      zone = r;
    }
  }
  return { d: best, zone };
}

export function decide(
  world: World,
  op: OperatorSettings,
  master: Master,
  lon: number,
  lat: number,
  h: number,
  rec: Receiver,
  live = true
): Decision {
  const err = gnssErr(lon, lat, rec, world);
  const drift = DRIFT_BASE + K_HEIGHT * Math.max(0, op.height - 2);
  const react = op.speed * op.valve;
  const wth = (op.wbear * Math.PI) / 180,
    we = Math.sin(wth),
    wn = Math.cos(wth);
  const noz = nozzlePositions(lon, lat, h);
  const na = naFix(op);
  const st: NozzleState[] = [];
  let mc = Infinity,
    ns = 0,
    amb = 0,
    litres = 0,
    cost = 0;
  const shut: number[] = [];

  for (let i = 0; i < NN; i++) {
    const [nl, nb] = noz[i];
    const { d: dR, zone } = distRestricted(nl, nb, world);
    let dw = 0;
    if (zone && op.wind > 0) {
      const [cx, cy] = centroid(zone.ring);
      const de = (cx - nl) * mlon(nb),
        dn = (cy - nb) * M_LAT;
      const n = Math.hypot(de, dn) || 1;
      const al = Math.max(0, (we * de + wn * dn) / n);
      dw = op.wind * K_WIND * al;
    }
    const buf = err + drift + react + dw;
    const tree = world.obstacles.some((o) => distM(nl, nb, o.lon, o.lat) < o.rAvoid);
    const inside = world.crops.filter((c) => pointInPolygon(nl, nb, c.ring));
    const crop = inside[0] || null;
    const ambN =
      !!crop && world.crops.some((o) => o !== crop && distToPolygonEdge(nl, nb, o.ring) < err);
    const geom = dR >= buf && !!crop && !tree;
    const spray = live && master === "off" ? false : geom;
    if (spray) {
      ns++;
      litres += crop!.dose * na;
      cost += crop!.dose * na * crop!.price;
      if (ambN) amb++;
    } else shut.push(i + 1);
    mc = Math.min(mc, dR);
    st.push({ spray, clear: dR, crop: crop?.crop ?? null, cropId: crop?.id ?? "—", amb: ambN, tree, buf });
  }

  const buf0 = st[0].buf;
  let reason: string,
    kind: Decision["kind"];
  if (master === "off" && live) {
    kind = "warn";
    reason = "MASTER OFF — operator override. All nozzles held closed regardless of geometry.";
  } else if (ns === NN) {
    kind = "ok";
    reason = `All ${NN} nozzles SPRAY.\nNearest nozzle ${mc.toFixed(1)} m from the nearest restricted zone.\nBuffer ${buf0.toFixed(1)} m = gnss ${err.toFixed(1)} + drift ${drift.toFixed(1)} (height ${op.height} m) + react ${react.toFixed(1)} (speed ${op.speed}).\nMargin verified -> spray authorised.`;
  } else if (ns === 0) {
    kind = "crit";
    reason = `FULL BOOM CUT.\nNearest nozzle ${mc.toFixed(1)} m < buffer ${buf0.toFixed(1)} m.\nCannot prove zero drift -> all nozzles OFF.`;
  } else {
    const why = st.some((s) => s.tree) ? "tree / zone avoidance" : "buffer breach near a restricted zone";
    kind = "warn";
    reason = `PARTIAL CUT — nozzles ${shut.join(", ")} OFF (${why}).\n${ns}/${NN} nozzles still spraying.`;
  }
  if (amb) reason += `\n[${amb} nozzle(s) crop-ambiguous: error radius spans the A|B seam -> wrong-dose risk]`;

  return { ns, shut, mc, err, buf: buf0, drift, react, litres, cost, amb, st, reason, kind };
}

export interface Series {
  area: number[];
  lit: number[];
  cost: number[];
  clear: number[];
  amb: number[];
}
export function computeSeries(
  world: World,
  op: OperatorSettings,
  coords: [number, number][],
  headings: number[],
  rec: Receiver
): Series {
  const na = naFix(op);
  let cA = 0,
    cL = 0,
    cC = 0,
    cAm = 0;
  const area: number[] = [],
    lit: number[] = [],
    cost: number[] = [],
    clear: number[] = [],
    amb: number[] = [];
  for (let i = 0; i < coords.length; i++) {
    const d = decide(world, op, "auto", coords[i][0], coords[i][1], headings[i], rec, false);
    cA += d.ns * na;
    cL += d.litres;
    cC += d.cost;
    cAm += d.amb;
    area.push(cA);
    lit.push(cL);
    cost.push(cC);
    clear.push(d.mc);
    amb.push(cAm);
  }
  return { area, lit, cost, clear, amb };
}
