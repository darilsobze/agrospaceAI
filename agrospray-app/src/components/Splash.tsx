import { useState } from "react";
import { Database, Radio } from "lucide-react";
import { useSim } from "@/state/sim";
import { DroneConnect } from "./DroneConnect";

export function Splash({ onEnter }: { onEnter: () => void }) {
  const { setReceiver } = useSim();
  const [showConnect, setShowConnect] = useState(false);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50 px-6">
      <div className="max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-[#ea580c] text-lg font-bold text-white shadow-sm">A</div>

        <h1 className="mb-2 text-4xl font-bold tracking-tight text-slate-900">AgroSpray AI</h1>
        <p className="mb-4 text-base font-medium text-slate-500">Precision spray copilot for autonomous drones</p>
        <p className="mx-auto mb-8 max-w-md text-base leading-relaxed text-slate-600">
          Turns a spray drone's GPS position and the field map into real-time spray-or-shut-off decisions for every nozzle — down to the meter.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            onClick={onEnter}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            <Database size={18} />
            Load Real Zurich GNSS Track
          </button>
          <button
            onClick={() => setShowConnect(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            <Radio size={18} />
            Connect Live Drone Telemetry Stream
          </button>
        </div>

        <p className="mt-6 text-[12px] text-slate-400">
          Real Zurich Urban-MAV GNSS error · OpenStreetMap geodata · positions simulated, the world is real
        </p>
      </div>

      {showConnect && (
        <DroneConnect
          onClose={() => setShowConnect(false)}
          onConnect={(rec) => {
            setReceiver(rec);
            onEnter();
          }}
        />
      )}
    </div>
  );
}
