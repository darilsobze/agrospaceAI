import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { computeSeries, decide, naFix, type Series } from "@/lib/engine";
import { buildFrame, computeTreated, type Frame } from "@/lib/frame";
import {
  buildDronePath,
  DRONE_HEX,
  fieldColumns,
  makeClassify,
  MAX_DRONES,
  partitionColumns,
  type Edge,
  type PaintClass,
  type PathPoint,
} from "@/lib/flightSim";
import { loadWorld, TRACKS } from "@/lib/world";
import type { Decision, Master, OperatorSettings, Receiver, World } from "@/lib/types";

const world: World = loadWorld();
const frame: Frame = buildFrame(world);

export interface Drone {
  id: number;
  edge: Edge;
}

interface SimState {
  world: World;
  frame: Frame;
  receiver: Receiver;
  fix: number;
  maxFix: number;
  playing: boolean;
  op: OperatorSettings;
  master: Master;
  decision: Decision;
  series: Record<Receiver, Series>;
  treated: Float64Array;
  // fleet
  drones: Drone[];
  maxDrones: number;
  canEditFleet: boolean;
  dronePaths: PathPoint[][];
  classify: (x: number, z: number) => PaintClass;
  droneColor: (i: number) => string;
  addDrone: () => void;
  removeDrone: (id: number) => void;
  setDroneEdge: (id: number, edge: Edge) => void;
  setReceiver: (r: Receiver) => void;
  setFix: (f: number) => void;
  togglePlay: () => void;
  setOp: <K extends keyof OperatorSettings>(k: K, v: OperatorSettings[K]) => void;
  setMaster: (m: Master) => void;
}

const Ctx = createContext<SimState | null>(null);
const EDGES: Edge[] = ["S", "N", "W", "E"];

export function SimProvider({ children }: { children: ReactNode }) {
  const [receiver, setReceiver] = useState<Receiver>("1m");
  const [fix, setFix] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [master, setMaster] = useState<Master>("auto");
  const [op, setOpState] = useState<OperatorSettings>({ height: 3, speed: 6, valve: 0.3, wind: 0, wbear: 0, risk: 0.05 });
  const [drones, setDrones] = useState<Drone[]>([{ id: 1, edge: "S" }]);

  const maxFix = TRACKS[receiver].coords.length - 1;
  const canEditFleet = fix === 0 && !playing;

  const series = useMemo(() => {
    const out = {} as Record<Receiver, Series>;
    (["5m", "1m"] as Receiver[]).forEach((r) => {
      const t = TRACKS[r];
      out[r] = computeSeries(world, op, t.coords, t.headings, r);
    });
    return out;
  }, [op]);

  const treated = useMemo(() => {
    const t = TRACKS[receiver];
    return computeTreated(world, op, frame, t.coords, t.headings, receiver);
  }, [op, receiver]);

  const decision = useMemo(() => {
    const t = TRACKS[receiver];
    const [lon, lat] = t.coords[fix];
    return decide(world, op, master, lon, lat, t.headings[fix], receiver, true);
  }, [receiver, fix, op, master]);

  // one flight path per drone, over its own non-overlapping band of crop columns
  const dronePaths = useMemo(() => {
    const cols = fieldColumns(frame).columns;
    const bands = partitionColumns(cols, drones.length);
    return drones.map((d, i) => buildDronePath(frame, receiver, maxFix + 1, bands[i], d.edge, i + 1));
  }, [receiver, drones, maxFix]);

  const classify = useMemo(() => makeClassify(frame, fieldColumns(frame).columns), []);

  // playback loop
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (playing) {
      timer.current = window.setInterval(() => {
        setFix((f) => (f + 1) % TRACKS[receiver].coords.length);
      }, 120);
    }
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing, receiver]);

  const value: SimState = {
    world,
    frame,
    receiver,
    fix,
    maxFix,
    playing,
    op,
    master,
    decision,
    series,
    treated,
    drones,
    maxDrones: MAX_DRONES,
    canEditFleet,
    dronePaths,
    classify,
    droneColor: (i) => DRONE_HEX[i % DRONE_HEX.length],
    addDrone: () =>
      setDrones((d) =>
        !canEditFleet || d.length >= MAX_DRONES
          ? d
          : [...d, { id: (d[d.length - 1]?.id ?? 0) + 1, edge: EDGES[d.length % EDGES.length] }]
      ),
    removeDrone: (id) => setDrones((d) => (!canEditFleet || d.length <= 1 ? d : d.filter((x) => x.id !== id))),
    setDroneEdge: (id, edge) => setDrones((d) => (!canEditFleet ? d : d.map((x) => (x.id === id ? { ...x, edge } : x)))),
    setReceiver: (r) => {
      setReceiver(r);
      setFix((f) => Math.min(f, TRACKS[r].coords.length - 1));
    },
    setFix,
    togglePlay: () => setPlaying((p) => !p),
    setOp: (k, v) => setOpState((o) => ({ ...o, [k]: v })),
    setMaster,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSim(): SimState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSim must be used within SimProvider");
  return c;
}

export const total = (s: number[]) => s[s.length - 1] ?? 0;
export { naFix };
