import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { computeSeries, decide, naFix, type Series } from "@/lib/engine";
import { buildFrame, computeTreated, type Frame } from "@/lib/frame";
import { loadWorld, TRACKS } from "@/lib/world";
import type { Decision, Master, OperatorSettings, Receiver, World } from "@/lib/types";

const world: World = loadWorld();
const frame: Frame = buildFrame(world);

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
  setReceiver: (r: Receiver) => void;
  setFix: (f: number) => void;
  togglePlay: () => void;
  setOp: <K extends keyof OperatorSettings>(k: K, v: OperatorSettings[K]) => void;
  setMaster: (m: Master) => void;
}

const Ctx = createContext<SimState | null>(null);

export function SimProvider({ children }: { children: ReactNode }) {
  const [receiver, setReceiver] = useState<Receiver>("1m");
  const [fix, setFix] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [master, setMaster] = useState<Master>("auto");
  const [op, setOpState] = useState<OperatorSettings>({ height: 3, speed: 6, valve: 0.3, wind: 0, wbear: 0 });

  const maxFix = TRACKS[receiver].coords.length - 1;

  // series recompute only when the physics inputs change (not on every fix tick)
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
