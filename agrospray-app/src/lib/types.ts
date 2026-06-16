export type Receiver = "5m" | "1m";
export type Master = "auto" | "off";
export type LonLat = [number, number];

export interface Crop {
  id: string;
  crop: string;
  name: string;
  price: number; // € / litre
  dose: number; // litres / m²
  ring: LonLat[];
}
export interface Zone {
  name: string;
  subtype: string; // "organic" | "water" | ...
  ring: LonLat[];
}
export interface Obstacle {
  name: string;
  lon: number;
  lat: number;
  rAvoid: number;
  rGps: number;
}
export interface World {
  crops: Crop[];
  restricted: Zone[];
  obstacles: Obstacle[];
  bound?: LonLat[];
  seam?: LonLat[];
}
export interface Track {
  coords: LonLat[];
  headings: number[];
}

export interface OperatorSettings {
  height: number; // m
  speed: number; // m/s
  valve: number; // s
  wind: number; // m/s
  wbear: number; // deg, direction wind blows TOWARD
  risk: number; // max accepted P(drift across the line), e.g. 0.05 = 95% confidence
}

export interface NozzleState {
  spray: boolean;
  clear: number;
  crop: string | null;
  cropId: string;
  amb: boolean;
  tree: boolean;
  buf: number;
  p: number; // P(spray drifts across the restricted line) given the error distribution
}
export interface Decision {
  ns: number;
  shut: number[];
  mc: number;
  err: number;
  buf: number;
  drift: number;
  react: number;
  litres: number;
  cost: number;
  amb: number;
  st: NozzleState[];
  reason: string;
  kind: "ok" | "warn" | "crit";
}
