import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useSim } from "@/state/sim";
import { centroid } from "@/lib/geo";
import { nozzlePositions, NN } from "@/lib/engine";
import { TRACKS } from "@/lib/world";
import { PageHead } from "./PageHead";
import { KpiCard } from "./ui/card";

const ALT = 11;
const COL_UNTREATED = 0xcdd98a,
  COL_TREATED = 0x2f9e63;

export function FieldTwin3D() {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const { world, frame, decision: d, receiver, fix, treated } = useSim();
  const is1 = receiver === "1m";

  // build once
  useEffect(() => {
    if (!host.current || sceneRef.current) return;
    const el = host.current;
    const W = el.clientWidth,
      H = el.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdcebe0);
    scene.fog = new THREE.Fog(0xdcebe0, 260, 520);
    const cam = new THREE.PerspectiveCamera(45, W / H, 0.5, 2000);
    cam.position.set(frame.Wx / 2 - 70, 95, 70);
    const rend = new THREE.WebGLRenderer({ antialias: true });
    rend.setPixelRatio(Math.min(devicePixelRatio, 2));
    rend.setSize(W, H);
    el.appendChild(rend.domElement);
    const ctr = new OrbitControls(cam, rend.domElement);
    ctr.target.set(frame.Wx / 2, 0, -frame.Df * 0.55);
    ctr.maxPolarAngle = Math.PI / 2.05;
    ctr.minDistance = 40;
    ctr.maxDistance = 420;
    ctr.update();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7d5a, 0.9));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.8);
    sun.position.set(-80, 140, 60);
    scene.add(sun);

    const sx = frame.seamX;
    // tilled-soil beds (brown), one per crop parcel
    const cA = new THREE.Mesh(new THREE.PlaneGeometry(sx, frame.Df), new THREE.MeshLambertMaterial({ color: 0x7a5230 }));
    cA.rotation.x = -Math.PI / 2;
    cA.position.set(sx / 2, 0, -frame.Df / 2);
    scene.add(cA);
    const cB = new THREE.Mesh(new THREE.PlaneGeometry(frame.Wx - sx, frame.Df), new THREE.MeshLambertMaterial({ color: 0x6b4a2b }));
    cB.rotation.x = -Math.PI / 2;
    cB.position.set(sx + (frame.Wx - sx) / 2, 0, -frame.Df / 2);
    scene.add(cB);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, frame.Df), new THREE.MeshLambertMaterial({ color: 0x6f7a55 }));
    seam.position.set(sx, 0.15, -frame.Df / 2);
    scene.add(seam);
    const orgD = frame.Dall - frame.Df;
    const org = new THREE.Mesh(new THREE.PlaneGeometry(frame.Wx, orgD), new THREE.MeshLambertMaterial({ color: 0xb9c98a }));
    org.rotation.x = -Math.PI / 2;
    org.position.set(frame.Wx / 2, 0, -(frame.Df + orgD / 2));
    scene.add(org);
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(frame.Wx + 60, frame.Dall + 120), new THREE.MeshLambertMaterial({ color: 0x9a8c6a }));
    skirt.rotation.x = -Math.PI / 2;
    skirt.position.set(frame.Wx / 2, -0.3, -frame.Dall / 2);
    scene.add(skirt);
    const bnd = new THREE.Mesh(new THREE.BoxGeometry(frame.Wx, 1.4, 1.2), new THREE.MeshLambertMaterial({ color: 0xe8654f }));
    bnd.position.set(frame.Wx / 2, 0.7, -frame.Df);
    scene.add(bnd);

    // pond
    if (frame.water) {
      const wl = frame.water.map((p) => [frame.loX(p[0]), frame.loZ(p[1])]);
      const wx = wl.map((p) => p[0]),
        wz = wl.map((p) => p[1]);
      const wW = Math.max(...wx) - Math.min(...wx),
        wH = Math.max(...wz) - Math.min(...wz);
      const pond = new THREE.Mesh(new THREE.PlaneGeometry(wW, wH), new THREE.MeshLambertMaterial({ color: 0x4a78c0 }));
      pond.rotation.x = -Math.PI / 2;
      pond.position.set((Math.min(...wx) + Math.max(...wx)) / 2, 0.05, (Math.min(...wz) + Math.max(...wz)) / 2);
      scene.add(pond);
    }
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
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(o.rGps - 0.4, o.rGps, 40),
        new THREE.MeshBasicMaterial({ color: 0x9a8c6a, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(ox, 0.12, oz);
      scene.add(ring);
    }

    // crops — blocky voxel plants in rows: golden wheat (A) and leafy green rape (B)
    const g = frame.grid;
    const crop = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 2.4, 1.1), new THREE.MeshLambertMaterial({ vertexColors: true }), g.n);
    const m4 = new THREE.Matrix4();
    const wheat = new THREE.Color(0xd9b44a),
      rape = new THREE.Color(0x57a23a);
    for (let i = 0; i < g.n; i++) {
      m4.makeTranslation(g.xs[i], 1.25, g.zs[i]);
      crop.setMatrixAt(i, m4);
      crop.setColorAt(i, g.crop[i] === 0 ? wheat : rape);
    }
    crop.instanceMatrix.needsUpdate = true;
    if (crop.instanceColor) crop.instanceColor.needsUpdate = true;
    scene.add(crop);

    // highlighted spray trail laid on the field surface as the boom passes
    const tileRot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    const spray = new THREE.InstancedMesh(
      new THREE.CircleGeometry(2.7, 12),
      new THREE.MeshBasicMaterial({ color: 0x25e0a0, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
      g.n
    );
    spray.renderOrder = 2;
    const m0 = new THREE.Matrix4(),
      zero = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < g.n; i++) {
      m0.makeTranslation(g.xs[i], 0.16, g.zs[i]).multiply(tileRot).scale(zero); // hidden until sprayed
      spray.setMatrixAt(i, m0);
    }
    spray.instanceMatrix.needsUpdate = true;
    scene.add(spray);

    // GPS beacon on each crop parcel: pole + device + pulsing ground ring + signal beam
    const beaconRings: THREE.Mesh[] = [];
    world.crops.forEach((c, i) => {
      const [clon, clat] = centroid(c.ring);
      const cx = frame.loX(clon),
        cz = frame.loZ(clat);
      const col = i === 0 ? 0x2f9e63 : 0x3fae9a;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 6, 6), new THREE.MeshLambertMaterial({ color: 0x2a2f2a }));
      pole.position.set(cx, 3, cz);
      scene.add(pole);
      const dev = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1), new THREE.MeshLambertMaterial({ color: 0x1b211b }));
      dev.position.set(cx, 6.2, cz);
      scene.add(dev);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), new THREE.MeshBasicMaterial({ color: col }));
      top.position.set(cx, 6.9, cz);
      scene.add(top);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.2, 1.7, 32),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cx, 0.18, cz);
      scene.add(ring);
      beaconRings.push(ring);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 44, 4),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.14 })
      );
      beam.position.set(cx, 22, cz);
      scene.add(beam);
    });

    // direction indicator: ground arrow under the drone + projected path-preview line
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xef8a3c, transparent: true, opacity: 0.9 })
    );
    arrow.position.y = 0.4;
    scene.add(arrow);
    const pathLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xef8a3c }));
    scene.add(pathLine);
    const clock = new THREE.Clock();

    // drone + cones + dots + disc
    const drone = new THREE.Group();
    drone.add(new THREE.Mesh(new THREE.BoxGeometry(3, 1, 3), new THREE.MeshLambertMaterial({ color: 0x222a22 })));
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 12), new THREE.MeshLambertMaterial({ color: 0x444444 }));
    boom.position.y = -0.6;
    drone.add(boom);
    scene.add(drone);
    const cones: THREE.Mesh[] = [],
      dots: THREE.Mesh[] = [];
    for (let i = 0; i < NN; i++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.6, 8.5, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x5b8def, transparent: true, opacity: 0.32, side: THREE.DoubleSide })
      );
      cone.visible = false;
      scene.add(cone);
      cones.push(cone);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), new THREE.MeshBasicMaterial({ color: 0x2f9e63 }));
      scene.add(dot);
      dots.push(dot);
    }
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40),
      new THREE.MeshBasicMaterial({ color: 0x5b8def, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.15;
    scene.add(disc);

    let alive = true;
    const loop = () => {
      if (!alive) return;
      requestAnimationFrame(loop);
      const tt = clock.getElapsedTime();
      const s = 1 + 0.45 * (0.5 + 0.5 * Math.sin(tt * 3));
      for (const r of beaconRings) {
        r.scale.set(s, s, 1);
        (r.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(tt * 3));
      }
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
    sceneRef.current = { scene, cam, rend, ctr, crop, spray, tileRot, cones, dots, drone, disc, arrow, pathLine, treatedShown: -1, dispose: () => {
      alive = false;
      window.removeEventListener("resize", onResize);
      rend.dispose();
      el.removeChild(rend.domElement);
    }};
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [world, frame]);

  // update on state change
  useEffect(() => {
    const S = sceneRef.current;
    if (!S) return;
    const t = TRACKS[receiver];
    const [lon, lat] = t.coords[fix];
    const h = t.headings[fix];
    const dx = frame.loX(lon),
      dz = frame.loZ(lat);
    S.drone.position.set(dx, ALT, dz);
    S.drone.rotation.y = h === 90 ? 0 : Math.PI;
    S.disc.position.set(dx, 0.15, dz);
    S.disc.scale.set(d.buf, d.buf, 1);
    // direction arrow on the ground, ahead of the drone, pointing where it will move
    const dir = h === 90 ? 1 : -1;
    S.arrow.position.set(dx + dir * 6, 0.4, dz);
    S.arrow.rotation.z = -dir * (Math.PI / 2);
    // projected path preview: the next ~45 fixes drawn on the field surface
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 45; k++) {
      const idx = Math.min(fix + k, t.coords.length - 1);
      const [plon, plat] = t.coords[idx];
      pts.push(new THREE.Vector3(frame.loX(plon), 0.5, frame.loZ(plat)));
    }
    S.pathLine.geometry.setFromPoints(pts);
    const noz = nozzlePositions(lon, lat, h);
    for (let i = 0; i < NN; i++) {
      const nx = frame.loX(noz[i][0]),
        nz = frame.loZ(noz[i][1]),
        on = d.st[i].spray;
      S.dots[i].position.set(nx, ALT - 0.6, nz);
      (S.dots[i].material as THREE.MeshBasicMaterial).color.setHex(on ? 0x2f9e63 : 0xe8654f);
      S.cones[i].visible = on;
      if (on) S.cones[i].position.set(nx, (ALT - 0.6) / 2 + 1, nz);
    }
    if (S.treatedShown !== fix || S.lastTreated !== treated) {
      const g = frame.grid;
      const m = new THREE.Matrix4(),
        zero = new THREE.Vector3(0, 0, 0);
      for (let c = 0; c < g.n; c++) {
        m.makeTranslation(g.xs[c], 0.16, g.zs[c]).multiply(S.tileRot);
        if (treated[c] > fix) m.scale(zero); // only show the sprayed cells
        S.spray.setMatrixAt(c, m);
      }
      S.spray.instanceMatrix.needsUpdate = true;
      S.treatedShown = fix;
      S.lastTreated = treated;
    }
  }, [d, receiver, fix, treated, frame]);

  let tre = 0;
  for (let c = 0; c < frame.grid.n; c++) if (treated[c] <= fix) tre++;
  const pct = Math.round((tre / frame.grid.n) * 100);

  return (
    <section>
      <PageHead
        module="Module 02 · 3D geospatial digital twin"
        title="Field Twin · 3D"
        sub="The drone flies the real track over a crop field. Spray cones fall from active nozzles; crops turn deep green as they are treated. The pale untreated border at 5 m closes at 1 m."
      />
      <div className="relative">
        <div ref={host} style={{ height: 540 }} className="overflow-hidden rounded-xl2 border border-line bg-[#cfe3d6]" />
        <div className="absolute left-3 top-3 rounded-[10px] border border-line bg-white/90 px-2.5 py-2 text-[12px] leading-relaxed text-mut">
          drag to orbit · scroll to zoom
          <br />
          <b className="text-[#b58a1f]">gold</b> = wheat (A) · <b className="text-[#3f7a2c]">green</b> = rape (B) on tilled soil
          <br />
          <b className="text-ink">blue cones</b> = active spray · <b className="text-[#15b07e]">teal trail</b> = sprayed area · <b className="text-ink">disc</b> = buffer
          <br />
          <b className="text-ink">red strip</b> = organic boundary · brown rings = tree GNSS hit
          <br />
          <b className="text-ink">poles</b> = per-crop GPS beacons · <b className="text-[#ef8a3c]">orange arrow + line</b> = drone heading / next path
        </div>
      </div>
      <div className="mt-3.5 grid grid-cols-4 gap-3.5">
        <KpiCard label="Active spray cones" value={`${d.ns}/6`} tone="green" foot="nozzles on" />
        <KpiCard label="Boundary clearance" value={`${d.mc.toFixed(1)} m`} tone={d.mc < d.buf ? "coral" : "green"} foot="nearest nozzle → zone" />
        <KpiCard label="Field treated" value={`${pct}%`} tone="green" foot="crops sprayed this run" />
        <KpiCard label="Error radius" value={is1 ? `${d.err.toFixed(2)} m` : `${d.err.toFixed(1)} m`} tone={is1 ? "green" : "orange"} foot="carried buffer input" />
      </div>
    </section>
  );
}
