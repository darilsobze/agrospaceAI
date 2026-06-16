import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useSim } from "@/state/sim";
import { BASE, gnssError } from "@/lib/engine";
import { CROP_HALF, fieldColumns, MAX_DRONES } from "@/lib/flightSim";
import { PageHead } from "./PageHead";
import { KpiCard } from "./ui/card";
import { ChevronDown, ChevronUp, ShieldAlert, ShieldCheck } from "lucide-react";

const LEGEND: { group: string; items: { c: string; l: string; line?: boolean }[] }[] = [
  {
    group: "Terrain",
    items: [
      { c: "#4e9c34", l: "Crop rows (your field)" },
      { c: "#d9b44a", l: "Neighbour wheat — no-spray" },
      { c: "#e8654f", l: "Organic boundary line" },
    ],
  },
  {
    group: "Spray coverage",
    items: [
      { c: "#3b82f6", l: "On-target (correct)" },
      { c: "#ff4d4d", l: "Wasted on bare soil" },
      { c: "#dc143c", l: "Across the line — €50k fine" },
    ],
  },
  {
    group: "Drone",
    items: [
      { c: "#ef8a3c", l: "Heading / next path", line: true },
      { c: "#2f9e63", l: "GPS signal beam (green→red)" },
    ],
  },
];

const ALT = 11;
const PAINT_RES = 4;
const BLUE = new THREE.Color(0x3b82f6); // pesticide correctly on the crop
const RED = new THREE.Color(0xff4d4d); // wasted on bare soil
const CRIMSON = new THREE.Color(0xdc143c); // across the organic line

function crossed(w: number, h: number): THREE.BufferGeometry {
  const a = new THREE.PlaneGeometry(w, h);
  const b = new THREE.PlaneGeometry(w, h);
  b.rotateY(Math.PI / 2);
  const m = mergeGeometries([a, b]);
  a.dispose();
  b.dispose();
  return m;
}
const wob = (i: number) => Math.sin(i * 1.7) * 1.2;

export function FieldTwin3D() {
  const host = useRef<HTMLDivElement>(null);
  const S = useRef<any>(null);
  const [legendOpen, setLegendOpen] = useState(true);
  const { frame, world, receiver, fix, dronePaths, classify, drones, droneColor } = useSim();

  // build scene + a pool of drone rigs + paint grid once
  useEffect(() => {
    if (!host.current || S.current) return;
    const el = host.current;
    const W = el.clientWidth,
      H = el.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdcebe0);
    scene.fog = new THREE.Fog(0xdcebe0, 520, 1300);
    const cam = new THREE.PerspectiveCamera(45, W / H, 0.5, 3000);
    cam.position.set(frame.Wx / 2 + 130, 180, 180);
    const rend = new THREE.WebGLRenderer({ antialias: true });
    rend.setPixelRatio(Math.min(devicePixelRatio, 2));
    rend.setSize(W, H);
    el.appendChild(rend.domElement);
    const ctr = new OrbitControls(cam, rend.domElement);
    ctr.target.set(frame.Wx / 2, 0, -frame.Df * 0.5);
    ctr.maxPolarAngle = Math.PI / 2.05;
    ctr.minDistance = 20;
    ctr.maxDistance = 900;
    ctr.zoomToCursor = true;
    ctr.screenSpacePanning = true;
    ctr.update();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7d5a, 0.95));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.75);
    sun.position.set(-80, 140, 60);
    scene.add(sun);

    // ground + neighbour wheat field + skirt + boundary
    const soil = new THREE.Mesh(new THREE.PlaneGeometry(frame.Wx, frame.Df), new THREE.MeshLambertMaterial({ color: 0x6e4a29 }));
    soil.rotation.x = -Math.PI / 2;
    soil.position.set(frame.Wx / 2, 0, -frame.Df / 2);
    scene.add(soil);
    const orgD = frame.Dall - frame.Df;
    const neigh = new THREE.Mesh(new THREE.PlaneGeometry(frame.Wx, orgD), new THREE.MeshLambertMaterial({ color: 0xcaa64a }));
    neigh.rotation.x = -Math.PI / 2;
    neigh.position.set(frame.Wx / 2, 0, -(frame.Df + orgD / 2));
    scene.add(neigh);
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(frame.Wx + 80, frame.Dall + 140), new THREE.MeshLambertMaterial({ color: 0x8f8164 }));
    skirt.rotation.x = -Math.PI / 2;
    skirt.position.set(frame.Wx / 2, -0.3, -frame.Dall / 2);
    scene.add(skirt);
    const bnd = new THREE.Mesh(new THREE.BoxGeometry(frame.Wx, 1.6, 1.4), new THREE.MeshLambertMaterial({ color: 0xe8654f }));
    bnd.position.set(frame.Wx / 2, 0.8, -frame.Df);
    scene.add(bnd);

    const fc = fieldColumns(frame);
    const tmp = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      sv = new THREE.Vector3(),
      up = new THREE.Vector3(0, 1, 0);
    // crop columns (green) — tall, dense
    const greenPts: THREE.Matrix4[] = [];
    let gi = 0;
    for (const cx of fc.columns) {
      for (let z = fc.zSouth; z >= fc.zCropNorth; z -= 1.8) {
        for (const ox of [-1.8, 1.8]) {
          const s = 0.85 + (gi % 3) * 0.14;
          q.setFromAxisAngle(up, (gi % 6) * 0.5);
          sv.set(s, s, s);
          tmp.compose(new THREE.Vector3(cx + ox + wob(gi) * 0.4, 2.6 * s, z + wob(gi + 3) * 0.3), q, sv);
          greenPts.push(tmp.clone());
          gi++;
        }
      }
    }
    const green = new THREE.InstancedMesh(crossed(3.0, 5.2), new THREE.MeshLambertMaterial({ color: 0x4e9c34, side: THREE.DoubleSide }), greenPts.length);
    greenPts.forEach((m, i) => green.setMatrixAt(i, m));
    green.instanceMatrix.needsUpdate = true;
    scene.add(green);
    // neighbour wheat
    const wheatPts: THREE.Matrix4[] = [];
    let wi = 0;
    for (let x = 2.5; x < frame.Wx; x += 3) {
      for (let z = -(frame.Df + 4); z > -frame.Dall; z -= 2.6) {
        const s = 0.9 + (wi % 3) * 0.13;
        q.setFromAxisAngle(up, (wi % 6) * 0.5);
        sv.set(s, s, s);
        tmp.compose(new THREE.Vector3(x + wob(wi) * 0.4, 2.8 * s, z + wob(wi + 2) * 0.3), q, sv);
        wheatPts.push(tmp.clone());
        wi++;
      }
    }
    const wheat = new THREE.InstancedMesh(crossed(2.4, 5.6), new THREE.MeshLambertMaterial({ color: 0xd9b44a, side: THREE.DoubleSide }), wheatPts.length);
    wheatPts.forEach((m, i) => wheat.setMatrixAt(i, m));
    wheat.instanceMatrix.needsUpdate = true;
    scene.add(wheat);
    // trees
    for (const o of world.obstacles) {
      const ox = frame.loX(o.lon),
        oz = frame.loZ(o.lat);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 4, 6), new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
      trunk.position.set(ox, 2, oz);
      scene.add(trunk);
      const fol = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 8), new THREE.MeshLambertMaterial({ color: 0x2c5d2c }));
      fol.position.set(ox, 6, oz);
      scene.add(fol);
    }

    // paint grid
    const txs: number[] = [],
      tzs: number[] = [];
    for (let x = PAINT_RES / 2; x < frame.Wx; x += PAINT_RES)
      for (let z = -PAINT_RES / 2; z > -frame.Dall; z -= PAINT_RES) {
        txs.push(x);
        tzs.push(z);
      }
    const tn = txs.length;
    const paint = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(PAINT_RES, PAINT_RES),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
      tn
    );
    paint.renderOrder = 3;
    const tileRot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    const zeroM = new THREE.Matrix4().scale(new THREE.Vector3(0, 0, 0));
    for (let i = 0; i < tn; i++) {
      paint.setMatrixAt(i, zeroM);
      paint.setColorAt(i, BLUE);
    }
    paint.instanceMatrix.needsUpdate = true;
    if (paint.instanceColor) paint.instanceColor.needsUpdate = true;
    scene.add(paint);

    // pool of drone rigs (hidden until used)
    const rigs: any[] = [];
    for (let i = 0; i < MAX_DRONES; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(3, 1, 3), new THREE.MeshLambertMaterial({ color: 0x222a22 })));
      const boom = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 0.5), new THREE.MeshLambertMaterial({ color: 0x444444 }));
      boom.position.y = -0.6;
      g.add(boom);
      const tag = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      tag.position.y = 1.3;
      g.add(tag);
      scene.add(g);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 4), new THREE.MeshBasicMaterial({ color: 0xef8a3c, transparent: true, opacity: 0.9 }));
      arrow.position.y = 0.4;
      scene.add(arrow);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(CROP_HALF, 9, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0x5b8def, transparent: true, opacity: 0.34, side: THREE.DoubleSide }));
      scene.add(cone);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(CROP_HALF, 24), new THREE.MeshBasicMaterial({ color: 0x5b8def, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.2;
      scene.add(disc);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 60, 6), new THREE.MeshBasicMaterial({ color: 0x2f9e63, transparent: true, opacity: 0.2 }));
      scene.add(beam);
      rigs.push({ g, tag, arrow, cone, disc, beam });
    }

    let alive = true;
    const loop = () => {
      if (!alive) return;
      requestAnimationFrame(loop);
      ctr.update();
      rend.render(scene, cam);
    };
    loop();
    const onResize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      rend.setSize(w, h);
    };
    window.addEventListener("resize", onResize);
    S.current = {
      scene, cam, rend, ctr, paint, rigs,
      tiles: { xs: txs, zs: tzs, n: tn },
      tileRot, paintState: new Uint8Array(tn), lastFix: -1, lastRec: "", lastPaths: null as any,
      dispose: () => {
        alive = false;
        window.removeEventListener("resize", onResize);
        rend.dispose();
        el.removeChild(rend.domElement);
      },
    };
    return () => {
      S.current?.dispose();
      S.current = null;
    };
  }, [frame, world]);

  function applyPaint(s: any) {
    const m = new THREE.Matrix4(),
      zero = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < s.tiles.n; i++) {
      const st = s.paintState[i];
      m.makeTranslation(s.tiles.xs[i], 0.24, s.tiles.zs[i]).multiply(s.tileRot);
      if (st === 0) m.scale(zero);
      else s.paint.setColorAt(i, st === 3 ? CRIMSON : st === 2 ? RED : BLUE);
      s.paint.setMatrixAt(i, m);
    }
    s.paint.instanceMatrix.needsUpdate = true;
    if (s.paint.instanceColor) s.paint.instanceColor.needsUpdate = true;
  }

  // per-frame update for the whole fleet
  useEffect(() => {
    const s = S.current;
    if (!s) return;
    // reset paint when the toggle, fleet, or playhead direction changes
    if (s.lastRec !== receiver || s.lastPaths !== dronePaths || fix < s.lastFix) {
      s.paintState.fill(0);
      s.lastFix = -1;
    }
    s.lastRec = receiver;
    s.lastPaths = dronePaths;

    const R2 = CROP_HALF * CROP_HALF;
    const stampAt = (x: number, z: number) => {
      for (let i = 0; i < s.tiles.n; i++) {
        const dx = s.tiles.xs[i] - x,
          dz = s.tiles.zs[i] - z;
        if (dx * dx + dz * dz <= R2) {
          const sev = classify(s.tiles.xs[i], s.tiles.zs[i]) + 1;
          if (sev > s.paintState[i]) s.paintState[i] = sev;
        }
      }
    };
    // replay every step since lastFix for every drone (history-accurate)
    for (let f = s.lastFix + 1; f <= fix; f++)
      for (const path of dronePaths) {
        const p = path[Math.min(f, path.length - 1)];
        stampAt(p.x, p.z);
      }
    s.lastFix = fix;
    applyPaint(s);

    // position + colour each rig
    s.rigs.forEach((rig: any, i: number) => {
      const path = dronePaths[i];
      const on = !!path && i < drones.length;
      [rig.g, rig.arrow, rig.cone, rig.disc, rig.beam].forEach((o) => (o.visible = on));
      if (!on) return;
      const p = path[Math.min(fix, path.length - 1)];
      rig.g.position.set(p.x, ALT, p.z);
      rig.g.rotation.y = Math.PI / 2;
      (rig.tag.material as THREE.MeshBasicMaterial).color.set(droneColor(i));
      const dz = p.north ? -1 : 1;
      rig.arrow.position.set(p.x, 0.4, p.z + dz * 6);
      rig.arrow.rotation.x = p.north ? -Math.PI / 2 : Math.PI / 2;
      rig.cone.position.set(p.x, 4.4, p.z);
      rig.disc.position.set(p.x, 0.2, p.z);
      rig.beam.position.set(p.x, 30, p.z);
      // GPS signal -> beam colour (green strong, orange/red weak near a tree)
      const lon = frame.unX(p.x),
        lat = frame.unZ(p.z);
      const err = gnssError(lon, lat, receiver, world);
      const qy = BASE[receiver] / err;
      (rig.beam.material as THREE.MeshBasicMaterial).color.setHex(qy > 0.8 ? 0x2f9e63 : qy > 0.55 ? 0xef8a3c : 0xe8654f);
    });
  }, [receiver, fix, dronePaths, drones]);

  // fleet KPIs
  let onCrop = 0,
    soil = 0,
    breach = 0;
  for (const path of dronePaths)
    for (let f = 0; f <= fix; f++) {
      const p = path[Math.min(f, path.length - 1)];
      const c = classify(p.x, p.z);
      if (c === 0) onCrop++;
      else if (c === 1) soil++;
      else breach++;
    }
  const tot = Math.max(1, (fix + 1) * dronePaths.length);
  const onTarget = Math.round((onCrop / tot) * 100);
  const wastePct = Math.round((soil / tot) * 100);
  const is1 = receiver === "1m";

  // live verdict from the fleet's CURRENT positions (matches the Command/Briefing message)
  let nowBreach = false,
    nowSoil = false;
  for (let i = 0; i < drones.length; i++) {
    const path = dronePaths[i];
    if (!path) continue;
    const p = path[Math.min(fix, path.length - 1)];
    const c = classify(p.x, p.z);
    if (c === 2) nowBreach = true;
    else if (c === 1) nowSoil = true;
  }
  const vTag = is1 ? "● ON TARGET" : nowBreach ? "● OUT OF SECTION" : "● ZIG-ZAG DRIFT";
  const vMsg = is1
    ? "Spraying to the line — pesticide on the crop row."
    : nowBreach
    ? "Spraying OUT OF SECTION — drift onto the neighbour's parcel. €50,000 fine incurred."
    : nowSoil
    ? "Spraying ZIG-ZAG — off the crop row, wasted on bare soil."
    : "Spraying ZIG-ZAG — GPS drift, not aligned to the crop row.";

  return (
    <section>
      <PageHead
        module="Module 02 · 3D geospatial digital twin"
        title="Field Twin · 3D"
        sub="Each drone flies its own band of crop columns. At 1 m the spray stays on the row (blue); at 5 m GPS drift wastes it on bare soil (red) or across the organic line (crimson)."
      />

      {/* AI verdict banner — same message as Command / AI Briefing */}
      <div className={`mb-3.5 flex items-center gap-3 rounded-xl2 border p-3 ${is1 ? "border-[#cfe9da] bg-gradient-to-r from-brand-bg to-white" : "border-[#f3d6cc] bg-gradient-to-r from-coral-bg to-white"}`}>
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${is1 ? "bg-brand text-white" : "animate-pulse bg-coral text-white"}`}>
          {is1 ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
        </div>
        <div className="flex-1">
          <div className={`text-[10px] font-extrabold tracking-widest ${is1 ? "text-brand-dark" : "text-coral-dark"} ${is1 ? "" : "animate-pulse"}`}>{vTag}</div>
          <div className="text-[15px] font-bold leading-tight">{vMsg}</div>
        </div>
        <span className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-bold ${is1 ? "border-[#bfe6d0] bg-brand-bg text-brand-dark" : "border-[#f1cdc2] bg-coral-bg text-coral-dark"}`}>
          {is1 ? `${onTarget}% on-target` : nowBreach ? "€50,000 fine · breach" : `${wastePct}% wasted`}
        </span>
      </div>

      <div className="relative">
        <div ref={host} style={{ height: 540 }} className="overflow-hidden rounded-xl2 border border-line bg-[#cfe3d6]" />
        <div className="absolute left-3 top-3 w-[214px] overflow-hidden rounded-xl border border-line bg-white/95 shadow-soft">
          <button onClick={() => setLegendOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-2 text-[12px] font-bold">
            Legend
            {legendOpen ? <ChevronUp size={14} className="text-mut" /> : <ChevronDown size={14} className="text-mut" />}
          </button>
          {legendOpen && (
            <div className="space-y-2.5 px-3 pb-3">
              {LEGEND.map((g) => (
                <div key={g.group}>
                  <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-mut">{g.group}</div>
                  <div className="space-y-1">
                    {g.items.map((it) => (
                      <div key={it.l} className="flex items-center gap-2">
                        <span className={it.line ? "h-[3px] w-3.5 shrink-0 rounded-full" : "h-3 w-3 shrink-0 rounded-[3px]"} style={{ background: it.c }} />
                        <span className="text-[11.5px] leading-tight text-ink">{it.l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="border-t border-line pt-2 text-[10.5px] leading-snug text-mut">drag orbit · scroll zoom-at-cursor · right-drag pan</div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3.5 grid grid-cols-4 gap-3.5">
        <KpiCard label="Drones flying" value={`${drones.length}`} tone="green" foot="non-overlapping bands" />
        <KpiCard label="On-target spray" value={`${onTarget}%`} tone={onTarget > 90 ? "green" : "orange"} foot="fleet, on the crop" />
        <KpiCard label="Soil waste" value={`${wastePct}%`} tone={wastePct > 5 ? "coral" : "green"} foot="pesticide on bare soil" />
        <KpiCard label="Boundary breaches" value={`${breach}`} tone={breach > 0 ? "coral" : "green"} foot="fixes across the organic line" />
      </div>
    </section>
  );
}
