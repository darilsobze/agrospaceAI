# AgroSpray AI — React app (Vite + TS + Tailwind)

The production-grade frontend for the EWIA "Down to the Meter" entry, rebuilt as a
real component app (same stack as the Wasteer copilot: **React 18 + TypeScript +
Tailwind + shadcn-style UI**). The decision engine is a typed, framework-free module
shared across every module.

```
src/
  lib/
    geo.ts        point-in-polygon, distances (ported 1:1 from starter geo_core.py)
    engine.ts     the decision engine: buffer = gnss + drift(height) + reaction(speed) + downwind(wind)
    frame.ts      local-metre frame + crop grid + "treated" precompute for the 3D twin
    world.ts      parses the real geodata (field.json) + drone tracks
    types.ts      typed domain model (Crop, Zone, Obstacle, Decision, …)
  state/sim.tsx   one React context: receiver, fix, wind, height, speed → live decision + series
  components/
    ui/           shadcn-style primitives (Card, Badge, Slider, Segmented, Sparkline)
    TopNav  ScenarioBanner  CommandCenter  BoomStrip  MiniMap (Leaflet)
    FieldTwin3D (Three.js)  AIBriefing  FollowVsIgnore  FleetAirspace  Playback  Transport
  data/           field.json + drone_5m.json + drone_1m.json (real-style geodata)
  App.tsx         tab router over the 6 modules
```

## Run

```bash
cd agrospray-app
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle into dist/
npm run preview    # serve the built bundle
```

## Deploy to Vercel (like the Wasteer copilot)

Vercel auto-detects Vite. Either:

- **Dashboard:** New Project → import the GitHub repo → set **Root Directory** to
  `agrospray-app` → deploy. Build command `npm run build`, output `dist`.
- **CLI:** `npm i -g vercel && cd agrospray-app && vercel`.

## Relationship to the other folder

`../agrospray/` holds the original single-file `agrospray.html` (zero-build, runs with
`python -m http.server`) plus the **Python** `engine.py` that writes the audit CSVs and
prints the 5 m↔1 m flip. This React app is the same logic and design, componentised and
type-safe, ready to deploy. The Python engine remains the offline proof artifact.
