// Minecraft-style voxel crop plants for the 3D Field Twin.
// Pure geometry: turns the frame's crop grid into instanced plant meshes.
// Wheat (crop 0) = tall gold (stalk + crossed blades + cap).
// Rape  (crop 1) = low green (crossed blades).
// A decorative density layer (DENSITY clumps per cell) packs the field to match
// crop_example_2.jpg; decorative plants are visual-only and not engine-indexed.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Frame } from "./frame";

const DENSITY = 3; // decorative clumps added around each real grid cell (0 = sparse)

// Deterministic in-cell offsets (metres). Indexed by (cellIndex + k) — NO RNG,
// NO Date.now (both banned here and non-deterministic).
const JITTER: [number, number][] = [
  [1.4, -0.7], [-1.1, 1.3], [0.6, 1.6], [-1.6, -1.0],
  [1.7, 0.9], [-0.8, -1.5], [1.0, -1.7], [-1.5, 0.5],
];
// Deterministic yaw (radians) so plants don't all face the same way.
const YAW = [0.0, 0.5, 1.1, 1.9, 2.5, 3.0, 0.8, 2.2];

const WHEAT_GOLD = 0xd9b44a;
const WHEAT_STALK = 0x9a8b3a;
const RAPE_GREEN = 0x57a23a;

interface Pt { x: number; z: number; slot: number }

// One geometry of two vertical planes crossed at 90° (a '+' from above).
function crossedPlanes(w: number, h: number): THREE.BufferGeometry {
  const a = new THREE.PlaneGeometry(w, h);
  const b = new THREE.PlaneGeometry(w, h);
  b.rotateY(Math.PI / 2);
  return mergeGeometries([a, b]);
}

export function buildCrops(frame: Frame): THREE.Group {
  const g = frame.grid;
  const group = new THREE.Group();

  // Collect plant positions per crop type: real cell first, then DENSITY clumps.
  const wheatPts: Pt[] = [];
  const rapePts: Pt[] = [];
  for (let i = 0; i < g.n; i++) {
    const arr = g.crop[i] === 0 ? wheatPts : rapePts;
    arr.push({ x: g.xs[i], z: g.zs[i], slot: i });
    for (let kk = 0; kk < DENSITY; kk++) {
      const j = JITTER[(i + kk) % JITTER.length];
      arr.push({ x: g.xs[i] + j[0], z: g.zs[i] + j[1], slot: i + kk + 1 });
    }
  }

  const tmp = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);

  function makePiece(geo: THREE.BufferGeometry, pts: Pt[], y: number, color: number, doubleSide: boolean): THREE.InstancedMesh {
    const mat = new THREE.MeshLambertMaterial(doubleSide ? { side: THREE.DoubleSide } : {});
    const im = new THREE.InstancedMesh(geo, mat, pts.length);
    const col = new THREE.Color(color);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      quat.setFromAxisAngle(up, YAW[p.slot % YAW.length]);
      pos.set(p.x, y, p.z);
      tmp.compose(pos, quat, scl);
      im.setMatrixAt(i, tmp);
      im.setColorAt(i, col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    return im;
  }

  // Wheat: stalk + crossed gold blades + small gold cap.
  if (wheatPts.length > 0) {
    group.add(makePiece(new THREE.BoxGeometry(0.35, 2.4, 0.35), wheatPts, 1.2, WHEAT_STALK, false));
    group.add(makePiece(crossedPlanes(2.2, 1.6), wheatPts, 2.6, WHEAT_GOLD, true));
    group.add(makePiece(new THREE.BoxGeometry(0.7, 0.7, 0.7), wheatPts, 3.4, WHEAT_GOLD, false));
  }
  // Rape: low crossed green blades only.
  if (rapePts.length > 0) {
    group.add(makePiece(crossedPlanes(1.8, 1.4), rapePts, 0.9, RAPE_GREEN, true));
  }

  return group;
}
