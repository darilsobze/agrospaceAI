import { useEffect, useRef } from "react";
import L from "leaflet";
import { useSim } from "@/state/sim";
import { gnssError } from "@/lib/engine";

const ll = (c: [number, number]): [number, number] => [c[1], c[0]];

export function MiniMap({ height = 320 }: { height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pool = useRef<{ marker: L.CircleMarker; err: L.Circle; path: L.Polyline }[]>([]);
  const { world, frame, dronePaths, fix, receiver, droneColor, maxDrones } = useSim();

  // build the map + static geometry + a pool of drone layers once
  useEffect(() => {
    if (!ref.current || map.current) return;
    const m = L.map(ref.current, { zoomControl: true, scrollWheelZoom: false }).setView([52.455, 5.52], 16);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, attribution: "© OpenStreetMap" }).addTo(m);
    const cropCol = ["#2f9e63", "#3fae9a"];
    world.crops.forEach((c, i) =>
      L.polygon(c.ring.map(ll), { color: cropCol[i % 2], weight: 2, fillColor: cropCol[i % 2], fillOpacity: 0.1 }).addTo(m).bindPopup(`${c.name} (crop ${c.id})`)
    );
    world.restricted.forEach((z) => {
      const col = z.subtype === "water" ? "#5b8def" : "#e8654f";
      L.polygon(z.ring.map(ll), { color: col, weight: 2, fillColor: col, fillOpacity: 0.18 }).addTo(m).bindPopup(z.name);
    });
    if (world.bound) L.polyline(world.bound.map(ll), { color: "#e8654f", weight: 4, dashArray: "3,6" }).addTo(m);
    if (world.seam) L.polyline(world.seam.map(ll), { color: "#888", weight: 1.5, dashArray: "4,5" }).addTo(m);
    world.obstacles.forEach((o) => {
      L.circle([o.lat, o.lon], { radius: o.rGps, color: "#9a8c6a", weight: 1, fillColor: "#9a8c6a", fillOpacity: 0.06, dashArray: "2,4" }).addTo(m);
      L.circleMarker([o.lat, o.lon], { radius: 5, color: "#5a4a2a", weight: 1, fillColor: "#7a5c2a", fillOpacity: 1 }).addTo(m).bindPopup(o.name);
    });
    const allLatLng = world.crops.flatMap((c) => c.ring).concat(world.restricted.flatMap((z) => z.ring)).map(ll);
    m.fitBounds(L.latLngBounds(allLatLng).pad(0.12));

    for (let i = 0; i < maxDrones; i++) {
      const path = L.polyline([], { color: "#888", weight: 1, opacity: 0.5, dashArray: "3,5" }).addTo(m);
      const err = L.circle([0, 0], { radius: 0, weight: 1, fillOpacity: 0.08 }).addTo(m);
      const marker = L.circleMarker([0, 0], { radius: 5, color: "#fff", weight: 2, fillOpacity: 1 }).addTo(m);
      pool.current.push({ marker, err, path });
    }
    map.current = m;
    setTimeout(() => m.invalidateSize(), 60);
  }, [world, maxDrones]);

  // redraw each drone's band path when the fleet changes
  useEffect(() => {
    pool.current.forEach((d, i) => {
      const pts = dronePaths[i];
      if (!pts) {
        d.path.setLatLngs([]);
        return;
      }
      d.path.setStyle({ color: droneColor(i), opacity: 0.55 });
      d.path.setLatLngs(pts.filter((_, k) => k % 6 === 0).map((p) => [frame.unZ(p.z), frame.unX(p.x)] as [number, number]));
    });
  }, [dronePaths]);

  // move each drone + its GPS-error circle every fix
  useEffect(() => {
    pool.current.forEach((d, i) => {
      const pts = dronePaths[i];
      if (!pts) {
        d.marker.setStyle({ opacity: 0, fillOpacity: 0 });
        d.err.setStyle({ opacity: 0, fillOpacity: 0 });
        return;
      }
      const p = pts[Math.min(fix, pts.length - 1)];
      const lon = frame.unX(p.x),
        lat = frame.unZ(p.z);
      const err = gnssError(lon, lat, receiver, world);
      const col = droneColor(i);
      d.marker.setLatLng([lat, lon]).setStyle({ color: "#fff", fillColor: col, opacity: 1, fillOpacity: 1 });
      d.err.setLatLng([lat, lon]).setRadius(err).setStyle({ color: col, opacity: 0.7, fillColor: col, fillOpacity: 0.08 });
    });
  }, [dronePaths, fix, receiver]);

  return <div ref={ref} style={{ height }} className="rounded-xl2 border border-line" />;
}
