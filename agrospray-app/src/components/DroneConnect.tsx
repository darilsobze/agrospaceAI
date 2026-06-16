import { useState } from "react";
import { Modal } from "./ui/modal";
import { Segmented } from "./ui/segmented";
import type { Receiver } from "@/lib/types";

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function Field({ label, hint, value, onChange, error, placeholder }: { label: string; hint?: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 flex items-baseline justify-between text-[12px] font-semibold text-ink">
        {label}
        {hint && <span className="font-normal text-mut">{hint}</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border px-3 py-2 text-[14px] outline-none transition-colors ${error ? "border-coral focus:border-coral" : "border-line focus:border-sky"}`}
      />
      {error && <p className="mt-1 text-[11.5px] text-coral-dark">{error}</p>}
    </div>
  );
}

export function DroneConnect({ onClose, onConnect }: { onClose: () => void; onConnect: (rec: Receiver) => void }) {
  // pre-filled with valid defaults so you can connect in one click
  const [id, setId] = useState("AGZ-001");
  const [ip, setIp] = useState("192.168.1.42");
  const [port, setPort] = useState("14550");
  const [rec, setRec] = useState<Receiver>("1m");
  const [err, setErr] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);

  function submit() {
    const e: Record<string, string> = {};
    if (!/^[A-Za-z0-9-]{3,}$/.test(id.trim())) e.id = "Drone ID: ≥3 chars (letters, numbers, dashes), e.g. AGZ-001.";
    if (!IPV4.test(ip.trim())) e.ip = "Enter a valid IPv4 address, e.g. 192.168.1.42.";
    const p = Number(port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) e.port = "Port must be a whole number between 1 and 65535.";
    setErr(e);
    if (Object.keys(e).length > 0) return; // bad info -> do NOT open the app

    // valid -> simulate a brief handshake, then enter the dashboard
    setConnecting(true);
    setTimeout(() => onConnect(rec), 650);
  }

  return (
    <Modal title="Connect drone telemetry" sub="Enter the drone's connection details to stream its live position into the decision engine." onClose={onClose}>
      <div className="space-y-3">
        <Field label="Drone ID" hint="e.g. AGZ-001" value={id} onChange={setId} error={err.id} placeholder="AGZ-001" />
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <Field label="IP address" value={ip} onChange={setIp} error={err.ip} placeholder="192.168.1.42" />
          <Field label="Port" value={port} onChange={setPort} error={err.port} placeholder="14550" />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink">GNSS receiver</label>
          <Segmented
            options={[
              { value: "1m", label: "1 m · Galileo HAS" },
              { value: "5m", label: "5 m · standard" },
            ]}
            value={rec}
            onChange={(v) => setRec(v as Receiver)}
            activeClass="bg-brand text-white"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11.5px] text-mut">Stream protocol: MAVLink / NMEA over UDP.</span>
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded-lg border border-line bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={connecting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {connecting ? "Connecting…" : "Connect & launch"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
