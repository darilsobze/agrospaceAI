import fieldJson from "@/data/field.json";
import drone5 from "@/data/drone_5m.json";
import drone1 from "@/data/drone_1m.json";
import type { LonLat, Track, World } from "./types";

const LETTERS = ["A", "B", "C", "D"];

export function loadWorld(): World {
  const world: World = { crops: [], restricted: [], obstacles: [] };
  let ci = 0;
  for (const ft of (fieldJson as any).features) {
    const p = ft.properties,
      gm = ft.geometry,
      role = p.role;
    if (role === "target_field")
      world.crops.push({
        id: LETTERS[ci++],
        crop: p.crop,
        name: p.name,
        price: p.price_eur_per_l ?? 12,
        dose: (p.dose_l_per_ha ?? 1.5) / 10000,
        ring: gm.coordinates[0].map((c: number[]) => [c[0], c[1]] as LonLat),
      });
    else if (role === "restricted")
      world.restricted.push({
        name: p.name,
        subtype: p.subtype ?? "",
        ring: gm.coordinates[0].map((c: number[]) => [c[0], c[1]] as LonLat),
      });
    else if (role === "obstacle")
      world.obstacles.push({
        name: p.name,
        lon: gm.coordinates[0],
        lat: gm.coordinates[1],
        rAvoid: p.r_avoid_m ?? 3,
        rGps: p.r_gps_m ?? 15,
      });
    else if (role === "legal_boundary") world.bound = gm.coordinates as LonLat[];
    else if (role === "crop_seam") world.seam = gm.coordinates as LonLat[];
  }
  return world;
}

function toTrack(j: any): Track {
  const f = j.features[0];
  return {
    coords: f.geometry.coordinates.map((c: number[]) => [c[0], c[1]] as LonLat),
    headings: f.properties.headings_deg,
  };
}

export const TRACKS: Record<"5m" | "1m", Track> = {
  "5m": toTrack(drone5),
  "1m": toTrack(drone1),
};
