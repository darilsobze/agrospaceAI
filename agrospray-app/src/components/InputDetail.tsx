import { useEffect, useRef } from "react";
import L from "leaflet";
import { useSim } from "@/state/sim";
import { gnssError, zForRisk } from "@/lib/engine";
import { TRACKS } from "@/lib/world";
import { Modal } from "./ui/modal";

const ll = (c: [number, number]): [number, number] => [c[1], c[0]];

// shared live map: zones + position + recent movement trail + GPS error circle
function DetailMap() {
  const ref = useRef<HTMLDivElement>(null);
  const M = useRef<any>(null);
  const { world, receiver, fix } = useSim();

  useEffect(() => {
    if (!ref.current || M.current) return;
    const m = L.map(ref.current, { zoomControl: true, scrollWheelZoom: true }).setView([52.455, 5.52], 16);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, attribution: "© OpenStreetMap" }).addTo(m);
    const cropCol = ["#2f9e63", "#3fae9a"];
    world.crops.forEach((c, i) => L.polygon(c.ring.map(ll), { color: cropCol[i % 2], weight: 2, fillColor: cropCol[i % 2], fillOpacity: 0.1 }).addTo(m).bindPopup(`${c.name} (crop ${c.id})`));
    world.restricted.forEach((z) => {
      const col = z.subtype === "water" ? "#5b8def" : "#e8654f";
      L.polygon(z.ring.map(ll), { color: col, weight: 2, fillColor: col, fillOpacity: 0.18 }).addTo(m).bindPopup(z.name);
    });
    if (world.bound) L.polyline(world.bound.map(ll), { color: "#e8654f", weight: 4, dashArray: "3,6" }).addTo(m);
    if (world.seam) L.polyline(world.seam.map(ll), { color: "#888", weight: 1.5, dashArray: "4,5" }).addTo(m);
    world.obstacles.forEach((o) => L.circleMarker([o.lat, o.lon], { radius: 5, color: "#5a4a2a", weight: 1, fillColor: "#7a5c2a", fillOpacity: 1 }).addTo(m).bindPopup(o.name));
    const allLL = world.crops.flatMap((c) => c.ring).concat(world.restricted.flatMap((z) => z.ring)).map(ll);
    m.fitBounds(L.latLngBounds(allLL).pad(0.1));
    const trail = L.polyline([], { color: "#1b211b", weight: 2.5, opacity: 0.75 }).addTo(m);
    const circle = L.circle([0, 0], { radius: 0, color: "#5b8def", weight: 1.5, fillColor: "#5b8def", fillOpacity: 0.12 }).addTo(m);
    const marker = L.circleMarker([0, 0], { radius: 6, color: "#fff", weight: 2, fillColor: "#1b211b", fillOpacity: 1 }).addTo(m);
    M.current = { m, trail, circle, marker };
    setTimeout(() => m.invalidateSize(), 70);
    return () => {
      m.remove();
      M.current = null;
    };
  }, [world]);

  useEffect(() => {
    if (!M.current) return;
    const t = TRACKS[receiver];
    const [lon, lat] = t.coords[fix];
    M.current.trail.setLatLngs(t.coords.slice(Math.max(0, fix - 40), fix + 1).map((c) => [c[1], c[0]] as [number, number]));
    M.current.marker.setLatLng([lat, lon]);
    M.current.circle.setLatLng([lat, lon]).setRadius(gnssError(lon, lat, receiver, world));
  }, [fix, receiver, world]);

  return <div ref={ref} style={{ height: 360 }} className="overflow-hidden rounded-xl border border-line" />;
}

function Stat({ l, v, c }: { l: string; v: string; c?: string }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-mut">{l}</div>
      <div className="font-mono text-[15px] font-bold" style={{ color: c }}>{v}</div>
    </div>
  );
}

export function InputDetail({ index, onClose }: { index: number; onClose: () => void }) {
  const { world, receiver, fix, op, decision: d } = useSim();
  const t = TRACKS[receiver];
  const [lon, lat] = t.coords[fix];
  const prev = t.coords[Math.max(0, fix - 1)];
  const stepM = Math.hypot((lon - prev[0]) * 71768, (lat - prev[1]) * 111320);

  if (index === 0) {
    return (
      <Modal title="INPUT_01 · Live position & movement" sub="Real Zurich GNSS fix replayed onto the route — black trail = last 40 fixes, blue circle = GPS error σ." onClose={onClose}>
        <DetailMap />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat l="Latitude" v={lat.toFixed(6)} />
          <Stat l="Longitude" v={lon.toFixed(6)} />
          <Stat l="Heading" v={`${t.headings[fix].toFixed(0)}°`} />
          <Stat l="Ground speed" v={`${(stepM * 1).toFixed(1)} m/s`} />
          <Stat l="GNSS σ (error)" v={`${d.err.toFixed(2)} m`} c={receiver === "1m" ? "#1f7a4d" : "#b5631f"} />
          <Stat l="Fix index" v={`${fix} / ${t.coords.length - 1}`} />
          <Stat l="Receiver" v={receiver === "1m" ? "1 m HAS" : "5 m std"} c={receiver === "1m" ? "#1f7a4d" : "#b5631f"} />
          <Stat l="Worst P(drift)" v={`${(Math.max(...d.st.map((s) => s.p)) * 100).toFixed(1)}%`} c={Math.max(...d.st.map((s) => s.p)) > op.risk ? "#c84a35" : "#1f7a4d"} />
        </div>
      </Modal>
    );
  }

  if (index === 1) {
    return (
      <Modal title="INPUT_02 · OSM zone boundaries (geodata)" sub="The real-world geometry the decision is checked against — crops, restricted zones, the legal line and trees." onClose={onClose}>
        <DetailMap />
        <div className="mt-3 overflow-hidden rounded-lg border border-line">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-[#f6f8f4] text-left text-[10.5px] uppercase tracking-wide text-mut">
                <th className="p-2">Feature</th>
                <th className="p-2">Role</th>
                <th className="p-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {world.crops.map((c) => (
                <tr key={c.name} className="border-t border-line">
                  <td className="p-2">{c.name}</td>
                  <td className="p-2 text-brand-dark">crop {c.id}</td>
                  <td className="p-2 font-mono text-mut">{c.crop} · {(c.dose * 10000).toFixed(1)} L/ha · €{c.price}/L</td>
                </tr>
              ))}
              {world.restricted.map((z) => (
                <tr key={z.name} className="border-t border-line">
                  <td className="p-2">{z.name}</td>
                  <td className="p-2 text-coral-dark">no-spray</td>
                  <td className="p-2 font-mono text-mut">{z.subtype || "restricted"} · {z.ring.length - 1} nodes</td>
                </tr>
              ))}
              {world.obstacles.map((o) => (
                <tr key={o.name} className="border-t border-line">
                  <td className="p-2">{o.name}</td>
                  <td className="p-2 text-[#7a5c2a]">obstacle</td>
                  <td className="p-2 font-mono text-mut">avoid {o.rAvoid} m · GNSS hit {o.rGps} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    );
  }

  // INPUT_03 — geo_core + probability
  const z = zForRisk(op.risk);
  return (
    <Modal title="INPUT_03 · geo_core + P(drift)" sub="The actual geometry + statistics the engine runs each fix — no black box." onClose={onClose}>
      <pre className="overflow-auto rounded-xl border border-line bg-[#0f140f] p-4 font-mono text-[12.5px] leading-relaxed text-[#cfe9da]">
{`# geo_core.ts (ported 1:1 from geo_core.py)
point_in_polygon(lon, lat, ring)          -> nozzle inside a crop / zone?
dist_to_polygon_edge(lon, lat, ring)      -> metres to the nearest restricted edge

# uncertainty as a probability  (sigma = GNSS error)
margin  = clearance - drift - reaction - downwind
P(drift)= normCdf(-margin / sigma)
buffer  = z(${(op.risk * 100).toFixed(0)}%)·sigma + drift + reaction   (z=${z.toFixed(3)})
spray  iff  P(drift) <= ${op.risk * 100}% risk

# live values
sigma (gnss)   = ${d.err.toFixed(2)} m
drift / react  = ${d.drift.toFixed(2)} m / ${d.react.toFixed(2)} m
buffer         = ${d.buf.toFixed(2)} m
nearest zone   = ${d.mc.toFixed(2)} m`}
      </pre>
      <div className="mt-3 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-[#f6f8f4] text-left text-[10.5px] uppercase tracking-wide text-mut">
              <th className="p-2">Nozzle</th>
              <th className="p-2">Clearance</th>
              <th className="p-2">Crop</th>
              <th className="p-2">P(drift)</th>
              <th className="p-2">Decision</th>
            </tr>
          </thead>
          <tbody>
            {d.st.map((s, i) => (
              <tr key={i} className="border-t border-line">
                <td className="p-2 font-mono">N{i + 1}</td>
                <td className="p-2 font-mono">{s.clear.toFixed(1)} m</td>
                <td className="p-2">{s.cropId}{s.amb ? " ?" : ""}</td>
                <td className="p-2 font-mono" style={{ color: s.p > op.risk ? "#c84a35" : "#1f7a4d" }}>{(s.p * 100).toFixed(1)}%</td>
                <td className="p-2 font-bold" style={{ color: s.spray ? "#1f7a4d" : "#c84a35" }}>{s.spray ? "SPRAY" : s.tree ? "TREE" : "CUT"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
