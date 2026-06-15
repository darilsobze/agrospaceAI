# Minecraft-style Crop Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain single-box crops in the 3D Field Twin with Minecraft-style voxel plants (tall gold wheat, low green rape) plus a decorative density layer, so the field reads like `crop_example_2.jpg`.

**Architecture:** Extract crop geometry into a new pure helper `src/lib/cropMesh.ts` exporting `buildCrops(frame): THREE.Group`. It builds one `InstancedMesh` per visual piece (wheat stalk / wheat blades / wheat cap / rape blades), placing one plant per grid cell plus `DENSITY` decorative clumps around each. `FieldTwin3D.tsx` swaps its inline crop block for a single `buildCrops` call. The separate green-disc treatment overlay (`spray` mesh) and the spray engine are untouched.

**Tech Stack:** TypeScript, React, Three.js 0.160 (`InstancedMesh`, `BufferGeometryUtils.mergeGeometries`), Vite.

**Testing note (from approved spec):** This is purely visual geometry and the repo has no test runner. Per the approved spec we deviate from unit-test-first: the automated gate at each task is `npx tsc --noEmit` (must pass with zero errors), and correctness is confirmed by **visual checkpoints in the running dev server**, compared against `crop_example_2.jpg`. No new test framework is added.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/lib/cropMesh.ts` | Build all crop plant geometry (wheat + rape, real + decorative) from the frame grid. Pure, no React/engine. | **Create** |
| `src/components/FieldTwin3D.tsx` | Scene orchestrator. Calls `buildCrops` instead of inlining crop geometry. | **Modify** (lines 104-117) |

No other files change. The `spray` overlay (`FieldTwin3D.tsx:121-134`, updated 277-289) and `frame.ts` grid are not touched.

---

## Task 1: Install dependencies and confirm baseline

**Files:** none (environment setup)

The `agrospray-app/` package has no `node_modules` yet. TypeScript checks and the dev server need it. This task gets a known-good baseline before any code change.

- [ ] **Step 1: Install dependencies**

Run:
```bash
cd /home/ndh/agrospaceAI/agrospray-app && npm install
```
Expected: completes without error; `node_modules/` appears.

- [ ] **Step 2: Confirm the baseline type-checks**

Run:
```bash
cd /home/ndh/agrospaceAI/agrospray-app && npx tsc --noEmit
```
Expected: no output, exit code 0 (clean baseline).

- [ ] **Step 3: Start the dev server (exposed) in the background**

Run:
```bash
cd /home/ndh/agrospaceAI/agrospray-app && npm run dev -- --host
```
Expected: Vite prints a `Local: http://localhost:5173/` line (run it in the background so it keeps serving). Open that URL, go to the **Module 02 · Field Twin · 3D** view, and confirm the current field renders: tall gold and green **boxes** on brown soil, drone flying, green discs appearing as it sprays. This is the "before" state.

- [ ] **Step 4: Commit (no code yet — only the lockfile if it changed)**

```bash
cd /home/ndh/agrospaceAI && git add agrospray-app/package-lock.json && git commit -m "chore: install agrospray-app deps for crop-form work" || echo "nothing to commit"
```

---

## Task 2: Create `cropMesh.ts` with the voxel plant builder

**Files:**
- Create: `agrospray-app/src/lib/cropMesh.ts`

This is the whole geometry helper: deterministic jitter/yaw tables (no `Math.random`), wheat (stalk + crossed blades + gold cap) and rape (low crossed green blades), one plant per grid cell plus `DENSITY` decorative clumps.

- [ ] **Step 1: Write the full helper**

Create `agrospray-app/src/lib/cropMesh.ts` with exactly:

```ts
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
```

- [ ] **Step 2: Type-check the new file**

Run:
```bash
cd /home/ndh/agrospaceAI/agrospray-app && npx tsc --noEmit
```
Expected: no output, exit code 0. (The file is not yet imported anywhere, so this only proves it compiles in isolation.)

- [ ] **Step 3: Commit**

```bash
cd /home/ndh/agrospaceAI && git add agrospray-app/src/lib/cropMesh.ts && git commit -m "feat: add buildCrops voxel plant geometry helper"
```

---

## Task 3: Wire `buildCrops` into the Field Twin and remove the old crop block

**Files:**
- Modify: `agrospray-app/src/components/FieldTwin3D.tsx` (import + lines 104-117)

The current block builds the single-box `InstancedMesh`. Replace the geometry lines with a `buildCrops(frame)` call. Keep `const g = frame.grid;` (line 105) — the `spray` overlay below still uses `g`.

- [ ] **Step 1: Add the import**

In `FieldTwin3D.tsx`, after the existing `import { TRACKS } from "@/lib/world";` line (line 7), add:

```ts
import { buildCrops } from "@/lib/cropMesh";
```

- [ ] **Step 2: Replace the crop geometry block**

Replace these lines (current 104-117):

```ts
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
```

with:

```ts
    // crops — Minecraft-style voxel plants (tall gold wheat A, low green rape B)
    // built in lib/cropMesh; the treatment green-disc overlay below is separate.
    const g = frame.grid; // still used by the spray overlay
    const crop = buildCrops(frame);
    scene.add(crop);
```

(`crop` is now a `THREE.Group`; it is stored in `sceneRef.current` as `crop` but never read after build, so the type change is safe — `sceneRef.current` is typed `any`.)

- [ ] **Step 3: Type-check**

Run:
```bash
cd /home/ndh/agrospaceAI/agrospray-app && npx tsc --noEmit
```
Expected: no output, exit code 0.

- [ ] **Step 4: Visual checkpoint in the dev server**

With the dev server from Task 1 still running, open `http://localhost:5173/`, go to **Module 02 · Field Twin · 3D**. Confirm against `crop_example_2.jpg`:

1. Wheat side (left/parcel A) reads as **tall gold** plants — visible thin stalks with a crossed golden head and a small cap, not plain boxes.
2. Rape side (parcel B) reads as **low green** bushes, clearly shorter and distinct from the wheat.
3. The field looks **densely packed** (decorative clumps filling between the 5 m grid points), like the photo.
4. As the drone flies, **green treatment discs still appear** over sprayed cells (overlay intact).
5. Camera orbit stays smooth (no obvious frame-rate collapse).

If wheat/rape look swapped, mistinted, or float/sink, adjust the `y` values or colors in `cropMesh.ts` (`makePiece` calls) and re-check. If the field is too sparse or too dense, change `DENSITY` in `cropMesh.ts`.

- [ ] **Step 5: Commit**

```bash
cd /home/ndh/agrospaceAI && git add agrospray-app/src/components/FieldTwin3D.tsx && git commit -m "feat: render Minecraft-style voxel crops in Field Twin"
```

---

## Task 4: Final verification pass

**Files:** none (verification + any tuning commits)

- [ ] **Step 1: Full type-check + production build**

Run:
```bash
cd /home/ndh/agrospaceAI/agrospray-app && npx tsc --noEmit && npm run build
```
Expected: `tsc` clean, `vite build` completes and writes `dist/` with no errors.

- [ ] **Step 2: Final visual confirmation**

In the dev server, do one full playback of the drone track on the Field Twin. Confirm all five checkpoints from Task 3 Step 4 hold for the entire run (start, mid-field across the A/B seam, and end). Compare the packed gold field directly against `crop_example_2.jpg`.

- [ ] **Step 3: Commit any tuning changes**

If you adjusted `DENSITY`, colors, or `y`/size values during verification:
```bash
cd /home/ndh/agrospaceAI && git add -A && git commit -m "tune: crop voxel density and proportions" || echo "nothing to commit"
```

---

## Self-Review (done while writing — recorded for the executor)

- **Spec coverage:** distinct wheat/rape forms → Task 2 (`makePiece` calls). Decorative density → Task 2 (`DENSITY` loop). Per-piece InstancedMesh / Option A → Task 2. Helper extraction `cropMesh.ts` → Task 2; wiring + removing old block → Task 3. Treatment overlay untouched → Task 3 explicitly keeps `spray` and `g`. Deterministic, no RNG → `JITTER`/`YAW` tables. Browser verification → Tasks 3-4. All spec sections covered.
- **Type consistency:** `buildCrops(frame: Frame): THREE.Group` defined in Task 2, called identically in Task 3. `Frame` imported from `./frame` (its real export, confirmed). `g.n/xs/zs/crop` match `frame.ts` grid shape. `mergeGeometries` imported from the three 0.160 `BufferGeometryUtils.js` path (same `three/examples/jsm/...` convention already used for `OrbitControls`).
- **Placeholder scan:** none — every code step is complete, every command has expected output.
