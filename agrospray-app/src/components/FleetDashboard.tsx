import { useSim } from "@/state/sim";
import { BASE, gnssError } from "@/lib/engine";
import { Card } from "./ui/card";
import { Segmented } from "./ui/segmented";
import type { Edge } from "@/lib/flightSim";

const EDGE_OPTS: { value: Edge; label: string }[] = [
  { value: "S", label: "S" },
  { value: "N", label: "N" },
  { value: "W", label: "W" },
  { value: "E", label: "E" },
];

export function FleetDashboard() {
  const { drones, maxDrones, canEditFleet, addDrone, removeDrone, setDroneEdge, dronePaths, fix, receiver, world, frame, droneColor } = useSim();

  return (
    <Card className="mt-3.5">
      <div className="flex items-center justify-between">
        <span className="upper">Drone fleet</span>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-mut">
            {drones.length}/{maxDrones} drones
          </span>
          <button
            onClick={addDrone}
            disabled={!canEditFleet || drones.length >= maxDrones}
            className="rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add drone
          </button>
        </div>
      </div>

      {!canEditFleet && (
        <div className="mt-2 rounded-lg bg-orange-bg px-3 py-2 text-[12px] text-[#b5631f]">
          Drones can only be added or changed at the start — rewind to fix 0 and pause to edit the fleet.
        </div>
      )}

      <div className="mt-3 space-y-2">
        {drones.map((d, i) => {
          const p = dronePaths[i]?.[Math.min(fix, (dronePaths[i]?.length ?? 1) - 1)];
          const lon = p ? frame.unX(p.x) : 0;
          const lat = p ? frame.unZ(p.z) : 0;
          const err = p ? gnssError(lon, lat, receiver, world) : BASE[receiver];
          const q = BASE[receiver] / err; // 1 = clean, <1 = inflated near a tree
          const sigColor = q > 0.8 ? "#2f9e63" : q > 0.55 ? "#ef8a3c" : "#e8654f";
          const bars = q > 0.8 ? 3 : q > 0.55 ? 2 : 1;
          return (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
              <span className="h-3.5 w-3.5 rounded-full" style={{ background: droneColor(i) }} />
              <span className="text-[13px] font-semibold">Drone {d.id}</span>
              <span className="text-[11px] text-mut">start edge</span>
              <Segmented options={EDGE_OPTS} value={d.edge} onChange={(e) => setDroneEdge(d.id, e)} activeClass="bg-ink text-white" />
              <span className="flex-1" />
              {/* GPS signal */}
              <span className="flex items-end gap-[2px]" title={`GPS error ${err.toFixed(2)} m`}>
                {[0, 1, 2].map((b) => (
                  <span
                    key={b}
                    style={{ background: b < bars ? sigColor : "#dfe3dc", height: 5 + b * 4 }}
                    className="w-[3px] rounded-sm"
                  />
                ))}
              </span>
              <span className="font-mono text-[11px]" style={{ color: sigColor }}>
                GPS {err.toFixed(2)} m
              </span>
              <button
                onClick={() => removeDrone(d.id)}
                disabled={!canEditFleet || drones.length <= 1}
                className="rounded-full px-2 text-[14px] text-mut hover:text-coral-dark disabled:opacity-30"
                title="remove drone"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[11px] text-mut">
        Each drone sprays its own non-overlapping band of crop columns (no conflict) and starts from the chosen edge of the green field.
      </div>
    </Card>
  );
}
