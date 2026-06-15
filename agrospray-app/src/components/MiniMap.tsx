import { useEffect, useRef } from "react";
import L from "leaflet";
import { useSim } from "@/state/sim";
import { nozzlePositions, NN } from "@/lib/engine";
import { TRACKS } from "@/lib/world";

const ll = (c: [number, number]): [number, number] => [c[1], c[0]];

export function MiniMap({ height = 320 }: { height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{ err: L.Circle; drone: L.CircleMarker; noz: L.CircleMarker[] } | null>(null);
  const { world, decision, receiver, fix } = useSim();

  useEffect(() => {
    if (!ref.current || map.current) return;
    const m = L.map(ref.current, { zoomControl: true, scrollWheelZoom: false }).setView([49.87, 8.5994], 17);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, attribution: "© OpenStreetMap" }).addTo(m);
    const cropCol = ["#2f9e63", "#3fae9a"];
    world.crops.forEach((c, i) => {
      L.polygon(c.ring.map(ll), { color: cropCol[i % 2], weight: 2, fillColor: cropCol[i % 2], fillOpacity: 0.1 })
        .addTo(m)
        .bindPopup(`${c.name} (crop ${c.id})`);
    });
    world.restricted.forEach((z) => {
      const col = z.subtype === "water" ? "#5b8def" : "#e8654f";
      L.polygon(z.ring.map(ll), { color: col, weight: 2, fillColor: col, fillOpacity: 0.18 }).addTo(m).bindPopup(z.name);
    });
    const allLatLng = world.crops
      .flatMap((c) => c.ring)
      .concat(world.restricted.flatMap((z) => z.ring))
      .map(ll);
    const bounds = L.latLngBounds(allLatLng);
    if (world.bound) L.polyline(world.bound.map(ll), { color: "#e8654f", weight: 4, dashArray: "3,6" }).addTo(m);
    if (world.seam) L.polyline(world.seam.map(ll), { color: "#888", weight: 1.5, dashArray: "4,5" }).addTo(m);
    world.obstacles.forEach((o) => {
      L.circle([o.lat, o.lon], { radius: o.rGps, color: "#9a8c6a", weight: 1, fillColor: "#9a8c6a", fillOpacity: 0.06, dashArray: "2,4" }).addTo(m);
      L.circleMarker([o.lat, o.lon], { radius: 5, color: "#5a4a2a", weight: 1, fillColor: "#7a5c2a", fillOpacity: 1 }).addTo(m).bindPopup(o.name);
    });
    const err = L.circle([0, 0], { radius: 0, color: "#5b8def", weight: 1.5, fillColor: "#5b8def", fillOpacity: 0.1 }).addTo(m);
    const drone = L.circleMarker([0, 0], { radius: 5, color: "#fff", weight: 2, fillColor: "#1b211b", fillOpacity: 1 }).addTo(m);
    const noz: L.CircleMarker[] = [];
    for (let i = 0; i < NN; i++) noz.push(L.circleMarker([0, 0], { radius: 4, weight: 1, color: "#fff" }).addTo(m));
    m.fitBounds(bounds.pad(0.12));
    map.current = m;
    layers.current = { err, drone, noz };
    setTimeout(() => m.invalidateSize(), 60);
  }, [world]);

  useEffect(() => {
    if (!layers.current) return;
    const t = TRACKS[receiver];
    const [lon, lat] = t.coords[fix];
    const h = t.headings[fix];
    layers.current.err.setLatLng([lat, lon]).setRadius(decision.buf);
    layers.current.drone.setLatLng([lat, lon]);
    nozzlePositions(lon, lat, h).forEach((p, i) =>
      layers.current!.noz[i].setLatLng([p[1], p[0]]).setStyle({ fillColor: decision.st[i].spray ? "#2f9e63" : "#e8654f", fillOpacity: 1 })
    );
  }, [decision, receiver, fix]);

  return <div ref={ref} style={{ height }} className="rounded-xl2 border border-line" />;
}
