// Vertical-flight visual simulation for the Field Twin.
// The drone flies parallel to the crop COLUMNS (north–south), column by column.
// Accuracy drives the trajectory:
//   1 m -> a straight, stable line centred on each crop column.
//   5 m -> sinusoidal + pseudo-random X drift (GPS zig-zag) and an over-shoot past
//          the organic boundary, so the spray lands on bare soil / the neighbour.
// Pure + deterministic (no RNG, no Date.now): identical every run.
import type { Frame } from "./frame";

export type PaintClass = 0 | 1 | 2; // 0 = on crop, 1 = soil waste, 2 = boundary contamination

export const COL_SPACING = 14; // metres between crop-column centres
export const CROP_HALF = 4; // half-width of the green crop strip (=> 6 m bare-soil gap)
const Z_SOUTH = -3;

export type Edge = "S" | "N" | "E" | "W";
export const MAX_DRONES = 5;
export const DRONE_HEX = ["#2f6bff", "#e8654f", "#9b51e0", "#f2b705", "#17b890"];
export const DRONE_HEXNUM = [0x2f6bff, 0xe8654f, 0x9b51e0, 0xf2b705, 0x17b890];

export interface PathPoint {
  x: number;
  z: number;
  north: boolean; // travelling toward the organic boundary?
}
export interface FlightSim {
  columns: number[];
  cropHalf: number;
  zSouth: number;
  zCropNorth: number; // northern extent of the planted crop
  path: PathPoint[];
  classify: (x: number, z: number) => PaintClass;
}

// small deterministic wobble so 5 m drift looks organic, not a pure sine
function noise(i: number): number {
  return Math.sin(i * 0.9) * 0.6 + Math.sin(i * 0.37 + 1.3) * 0.4;
}

export function buildFlightSim(frame: Frame, accuracy: "5m" | "1m", n: number): FlightSim {
  const columns: number[] = [];
  for (let x = COL_SPACING / 2; x < frame.Wx; x += COL_SPACING) columns.push(x);
  const Df = frame.Df;
  const zCropNorth = -(Df - 6); // crops stop 6 m short of the boundary
  // 1 m halts safely short of the line; 5 m over-shoots 2 m past it (breach)
  const zTop = accuracy === "1m" ? -(Df - 9) : -(Df + 2);
  const cols = columns.length;
  const per = Math.max(1, Math.floor(n / cols));

  const path: PathPoint[] = [];
  for (let i = 0; i < n; i++) {
    const pass = Math.min(cols - 1, Math.floor(i / per));
    const t = Math.min(1, (i - pass * per) / per);
    const north = pass % 2 === 0;
    const z = north ? Z_SOUTH + (zTop - Z_SOUTH) * t : zTop + (Z_SOUTH - zTop) * t;
    const baseX = columns[pass];
    let x = baseX;
    if (accuracy === "5m") {
      x = baseX + 5.5 * Math.sin(t * Math.PI * 3 + pass * 1.7) + 2.4 * noise(i);
    }
    path.push({ x, z, north });
  }

  const classify = (x: number, z: number): PaintClass => {
    if (z < -Df) return 2; // across the organic boundary -> contamination
    if (z > 0) return 0;
    let best = Infinity;
    for (const c of columns) best = Math.min(best, Math.abs(x - c));
    return best <= CROP_HALF ? 0 : 1; // on the green strip, else bare soil
  };

  return { columns, cropHalf: CROP_HALF, zSouth: Z_SOUTH, zCropNorth, path, classify };
}

// --- multi-drone helpers ---

// every crop column across the whole field (shared by crops + classifier)
export function fieldColumns(frame: Frame) {
  const columns: number[] = [];
  for (let x = COL_SPACING / 2; x < frame.Wx; x += COL_SPACING) columns.push(x);
  return { columns, cropHalf: CROP_HALF, zSouth: Z_SOUTH, zCropNorth: -(frame.Df - 6) };
}

// classification against ALL field columns (a tile is crop/soil/contamination)
export function makeClassify(frame: Frame, cols: number[]) {
  const Df = frame.Df;
  return (x: number, z: number): PaintClass => {
    if (z < -Df) return 2;
    if (z > 0) return 0;
    let best = Infinity;
    for (const c of cols) best = Math.min(best, Math.abs(x - c));
    return best <= CROP_HALF ? 0 : 1;
  };
}

// split the columns into k contiguous, non-overlapping bands (one per drone)
export function partitionColumns(all: number[], k: number): number[][] {
  const out: number[][] = [];
  const n = all.length;
  for (let i = 0; i < k; i++) out.push(all.slice(Math.floor((i * n) / k), Math.floor(((i + 1) * n) / k)));
  return out.map((b, i) => (b.length ? b : [all[Math.min(i, n - 1)] ?? frame_center(all)]));
}
function frame_center(all: number[]) {
  return all.length ? all[Math.floor(all.length / 2)] : 0;
}

// a single drone's vertical serpentine over ITS band, starting from the chosen edge
export function buildDronePath(
  frame: Frame,
  accuracy: "5m" | "1m",
  n: number,
  cols: number[],
  edge: Edge,
  seed: number
): PathPoint[] {
  const Df = frame.Df;
  const zTop = accuracy === "1m" ? -(Df - 9) : -(Df + 2);
  const order = edge === "E" ? [...cols].reverse() : [...cols];
  const startNorth = edge === "N";
  const m = Math.max(1, order.length);
  const per = Math.max(1, Math.floor(n / m));
  const path: PathPoint[] = [];
  for (let i = 0; i < n; i++) {
    const pass = Math.min(m - 1, Math.floor(i / per));
    const t = Math.min(1, (i - pass * per) / per);
    const goNorth = startNorth ? pass % 2 === 1 : pass % 2 === 0;
    const z = goNorth ? Z_SOUTH + (zTop - Z_SOUTH) * t : zTop + (Z_SOUTH - zTop) * t;
    const baseX = order[pass];
    let x = baseX;
    if (accuracy === "5m") x = baseX + 5.5 * Math.sin(t * Math.PI * 3 + pass * 1.7 + seed) + 2.4 * noise(i + seed * 13);
    path.push({ x, z, north: goNorth });
  }
  return path;
}
