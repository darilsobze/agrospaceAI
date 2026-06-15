# Minecraft-style crop forms in the Field Twin — Design

**Date:** 2026-06-15
**Reference image:** `crop_example_2.jpg` (dense field of golden Minecraft-style voxel wheat)
**Secondary reference:** `crop_example.jpg` (mixed Minecraft crops — leafy greens, root crops)

## Goal

Replace the plain single-box crop plants in the 3D Field Twin with detailed
Minecraft-style voxel forms that read like `crop_example_2.jpg`, while keeping
the two crop types visually distinguishable and leaving the spray/treatment
engine logic untouched.

## Background — current state

`FieldTwin3D.tsx:104-117` renders crops as a single `InstancedMesh`:

- Geometry: `BoxGeometry(1.1, 2.4, 1.1)` — one tall box per plant.
- One instance per crop-grid cell (grid built in `frame.ts`, `STEP = 5` m spacing).
- Color: gold `0xd9b44a` for wheat (crop A, `crop[i] === 0`), green `0x57a23a`
  for rape (crop B, `crop[i] === 1`), set **once at build** via `setColorAt`.

**The crop mesh is static build-once geometry.** It is colored once and never
touched again — `S.crop` is stored in `sceneRef` but the update effect never
references it. The "turns green when treated" effect is a **separate**
`spray` `InstancedMesh` of translucent green discs (`CircleGeometry`,
`FieldTwin3D.tsx:121-134`): every disc starts scaled to zero and the update loop
(`FieldTwin3D.tsx:277-289`) scales the disc for each treated cell into view as
the drone sprays. So treatment is an **overlay**, not a recolor of the crop.

This means the crop geometry can be replaced freely as long as we keep building
the same per-cell plant positions; the treatment overlay is independent and is
not modified by this work.

## Decisions (locked)

1. **Both crops get distinct Minecraft forms** — wheat-style for A, a different
   leafy-green form for B, so they stay distinguishable by *both shape and color*.
   The engine and the legend depend on telling A from B apart.
2. **Shape + decorative density** — keep the 5 m grid and treated-color logic
   exactly as-is; add a purely-decorative density layer so the field looks as
   packed as the photo. Decorative geometry is visual-only (never sprayed/treated).
3. **Crop B = low leafy green Minecraft crop** — low bushy green plant (crossed
   green blade-planes, no tall golden head). Strong contrast vs. tall gold wheat.
4. **Rendering = per-piece InstancedMesh layers (Option A)** — one `InstancedMesh`
   per visual piece, shared across the field. Keeps draw calls flat (~4-6 total)
   and leaves the separate spray/treated overlay logic completely untouched.

## Architecture & boundaries

All changes are contained to the 3D scene-build code.

### New file: `src/lib/cropMesh.ts`

Pure geometry helper, no React, no engine. One job: turn the crop grid into
voxel plants.

- Exports `buildCrops(frame)` returning a `THREE.Group` containing all crop
  instanced meshes (real + decorative). No recolor handle is needed — the crop
  mesh is static build-once geometry and the treatment overlay is a separate mesh
  this work does not touch.
- Holds the geometry definitions for both plant forms and the density constant.

### Modified: `src/components/FieldTwin3D.tsx`

- Replace the crop block (lines 104-117) with a call to `buildCrops(frame)`.
- Add the returned group to the scene, and store it in `sceneRef` in the slot
  currently holding `crop` (keeps the shape of `sceneRef` stable; the value is
  unused after build).
- The separate `spray` overlay block and the treated-update logic (lines 121-134,
  277-289) are **not modified**.

This isolates crop geometry from the orchestrator. `FieldTwin3D.tsx` is already
325 lines and doing a lot; extracting crops gives the new, more involved geometry
its own focused, independently-readable home.

## Plant geometry

Low-poly primitives, flat-shaded, matching the existing scene style.

### Wheat (crop A) — tall golden

- **Stalk:** thin vertical box, muted green-gold (~`0x9a8b3a`), ~2.4 tall
  (reuses current plant height so spacing reads the same).
- **Head:** two crossed thin blade-planes (`PlaneGeometry`, `+` from above) plus
  a small gold box cap, colored `0xd9b44a` (existing wheat gold) — the bushy
  Minecraft-wheat silhouette.

### Rape (crop B) — low green

- **No stalk/head.** Two crossed green blade-planes, shorter (~1.4 tall),
  colored `0x57a23a` (existing rape green) — a low leafy bush.

### Rendering (Option A)

- One `InstancedMesh` per distinct piece: `stalkIM`, `wheatBladeIM`,
  `wheatCapIM`, `rapeBladeIM`. Each sized to its required instance count.
- Crossed planes use `side: THREE.DoubleSide` so they show from all angles.
- Slight per-instance yaw rotation derived from the **cell index** (a small fixed
  lookup table indexed by index — **no `Math.random` / `Date.now`**, which are
  banned in this environment and break determinism) so the field isn't a rigid
  lattice.
- Each piece's instances are colored once at build via `setColorAt` and never
  recolored (matching the current static crop mesh).

## Treatment overlay (untouched)

The "turns green when treated" effect is **not** part of the crop mesh — it is a
separate `spray` `InstancedMesh` of translucent green discs that scale into view
per treated cell (`FieldTwin3D.tsx:121-134`, updated at lines 277-289). This work
does **not** modify that mesh or its update logic. The new crop geometry sits
underneath the same overlay, so as the drone sprays, green discs continue to
appear over the treated cells exactly as before.

Because the crop mesh is static build-once geometry, `buildCrops` needs no recolor
handle and no index-layout contract with the engine — real and decorative
instances can be laid out in any order.

## Decorative density layer

- For each real grid cell, add `DENSITY` decorative clumps (start `DENSITY = 3`)
  scattered within the 5 m cell, using a deterministic index-derived offset
  pattern (small fixed jitter table indexed by `(cellIndex, k)` — no RNG).
- Decorative clumps are extra instances of the **same pieces** — a wheat cell
  sprouts extra wheat clumps, a rape cell extra rape bushes. Draw-call count stays
  flat (just larger instance counts).
- Purely visual: never indexed by the engine. The photogenic density and the
  spray-treatment readout stay independent — the treated discs track the real
  grid; the surrounding decorative field just looks dense.
- `DENSITY` is a single constant at the top of `cropMesh.ts` — dial up/down, or
  set to 0 to recover the sparse look.

**Trade-off:** `DENSITY = 3` makes instance count ~4× today. Still tiny for
instanced rendering (thousands, not millions) and one draw call per piece. Drop
`DENSITY` if it ever feels heavy.

## Error handling

- Geometry-only, no I/O. Each instanced mesh sets `instanceMatrix.needsUpdate`
  (and `instanceColor.needsUpdate` behind the existing `if (instanceColor)`
  null-guard) after its instances are written, matching current code.

## Testing / verification

This is a visual change; the proof is in the browser (no test harness exists in
this repo, and asserting mesh vertex counts would be brittle and prove little —
explicitly deviating from test-first here).

Manual verification, comparing against `crop_example_2.jpg`:

1. Wheat reads as tall gold Minecraft wheat (stalk + crossed golden head).
2. Rape reads as low green bushes, clearly distinct from wheat.
3. The field looks densely packed (density layer working).
4. Sprayed cells still show the green treatment discs as the drone passes
   (the separate `spray` overlay is intact).
5. Framerate stays smooth.

Open to adding a smoke test if preferred.

## Out of scope

- No change to the crop grid spacing, `frame.ts`, or the treated-precompute.
- No texture assets / billboards (Option C rejected — heavier, stylistically off).
- No change to the standalone `agrospray/agrospray.html` (separate artifact).
- No change to crop B's classification as oilseed rape in the engine.
