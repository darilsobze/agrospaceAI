// Local-metre frame for the 3D twin + crop grid + "treated" precompute.
import { decide, NN, nozzlePositions } from "./engine";
import { M_LAT, mlon, pointInPolygon } from "./geo";
import type { OperatorSettings, Receiver, World } from "./types";

export interface Frame {
  LW: number;
  LS: number;
  k: number;
  Wx: number;
  Df: number;
  Dall: number;
  seamX: number;
  water: [number, number][] | null;
  loX: (lon: number) => number;
  loZ: (lat: number) => number;
  grid: { n: number; xs: number[]; zs: number[]; crop: number[] };
}

export function buildFrame(world: World): Frame {
  const allF = world.crops.flatMap((c) => c.ring);
  const lons = allF.map((p) => p[0]),
    lats = allF.map((p) => p[1]);
  const LW = Math.min(...lons),
    LE = Math.max(...lons),
    LS = Math.min(...lats),
    LNf = Math.max(...lats);
  const LNall = Math.max(...world.restricted.flatMap((r) => r.ring).map((p) => p[1]));
  const k = mlon(LS);
  const Wx = (LE - LW) * k,
    Df = (LNf - LS) * M_LAT,
    Dall = (LNall - LS) * M_LAT;
  const water = world.restricted.find((r) => r.subtype === "water")?.ring ?? null;
  const seamX = world.seam ? (world.seam[0][0] - LW) * k : Wx / 2;
  const loX = (lon: number) => (lon - LW) * k;
  const loZ = (lat: number) => -(lat - LS) * M_LAT;

  const xs: number[] = [],
    zs: number[] = [],
    crop: number[] = [],
    STEP = 5;
  for (let x = STEP / 2; x < Wx; x += STEP)
    for (let n = STEP / 2; n < Df; n += STEP) {
      const lon = LW + x / k,
        lat = LS + n / M_LAT;
      if (water && pointInPolygon(lon, lat, water)) continue;
      xs.push(x);
      zs.push(-n);
      crop.push(x < seamX ? 0 : 1);
    }
  return { LW, LS, k, Wx, Df, Dall, seamX, water, loX, loZ, grid: { n: xs.length, xs, zs, crop } };
}

// earliest fix index at which each crop cell gets treated, for a given receiver/settings
export function computeTreated(
  world: World,
  op: OperatorSettings,
  frame: Frame,
  coords: [number, number][],
  headings: number[],
  rec: Receiver
): Float64Array {
  const g = frame.grid;
  const earliest = new Float64Array(g.n).fill(Infinity);
  const aH = Math.max(3, op.speed * 0.6);
  for (let i = 0; i < coords.length; i++) {
    const [lo, la] = coords[i],
      h = headings[i];
    const d = decide(world, op, "auto", lo, la, h, rec, false);
    const dx = frame.loX(lo);
    const noz = d.st;
    const np = nozzleLocalZ(frame, lo, la, h);
    for (let kk = 0; kk < NN; kk++) {
      if (!noz[kk].spray) continue;
      const nz = np[kk];
      for (let c = 0; c < g.n; c++) {
        if (earliest[c] <= i) continue;
        if (Math.abs(g.xs[c] - dx) < aH && Math.abs(g.zs[c] - nz) < 1.0) earliest[c] = i;
      }
    }
  }
  return earliest;
}

// local Z of each nozzle
function nozzleLocalZ(frame: Frame, lon: number, lat: number, h: number): number[] {
  return nozzlePositions(lon, lat, h).map((p) => frame.loZ(p[1]));
}
