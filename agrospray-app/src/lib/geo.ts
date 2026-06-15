// Geometry ported 1:1 from the starter floor geo_core.py — pure functions.
import type { LonLat } from "./types";

export const M_LAT = 111320.0;
export const mlon = (lat: number) => M_LAT * Math.cos((lat * Math.PI) / 180);

export function pointInPolygon(lon: number, lat: number, ring: LonLat[]): boolean {
  let c = false;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    if (y1 > lat !== y2 > lat) {
      const xi = x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1);
      if (xi > lon) c = !c;
    }
  }
  return c;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax,
    dy = by - ay,
    den = dx * dx + dy * dy;
  const t = den === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / den));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function distToPolygonEdge(lon: number, lat: number, ring: LonLat[]): number {
  if (pointInPolygon(lon, lat, ring)) return 0;
  const k = mlon(lat),
    px = lon * k,
    py = lat * M_LAT;
  let best = Infinity;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n];
    best = Math.min(best, segDist(px, py, a[0] * k, a[1] * M_LAT, b[0] * k, b[1] * M_LAT));
  }
  return best;
}

export const distM = (al: number, aa: number, bl: number, ba: number) =>
  Math.hypot((al - bl) * mlon(aa), (aa - ba) * M_LAT);

export function centroid(ring: LonLat[]): LonLat {
  let x = 0,
    y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  return [x / ring.length, y / ring.length];
}
