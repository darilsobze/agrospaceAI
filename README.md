# 🌾 AgroSpray AI

**Real-time boom-control for spray drones — turning each GPS fix and the field map into a safe spray-or-shut-off decision for every nozzle, down to the meter.**

🔗 **Live demo:** https://agrospray-app.vercel.app
📦 **Code:** https://github.com/darilsobze/team-10-agrospaceAI

---

## 👥 Team

| | |
|---|---|
| **Team number** | 10 |
| **Team name** | `<!-- FILL IN -->` |
| **Members** | `<!-- FILL IN: full names of everyone -->` |

## 🎯 Challenge

**EWIA.tech — "Down to the Meter"**
*How might we find and build what only becomes possible when positioning comes down to one meter?*

---

## ❗ The problem & who has it

**Customer:** precision-agriculture **spray-drone operators** (and the ag-service
contractors who run them) in the EU.

A spray drone treats a conventional field that shares an edge with a **certified-organic
field**. By law (the **EU Sustainable Use Regulation** and German **PflSchG** buffer-zone
rules) **not one droplet** may drift across that boundary — if it does, the neighbour
**loses their organic certification** and the operator faces fines and liability.

The trap: a standard drone GPS is accurate to **~5 m**, but organic and conventional
parcels sit only **2–4 m apart**. **At 5 m the drone literally cannot tell which side of
the line it is on.** So the operator must either:

- **cut the boom metres early** → the field border goes untreated (lost yield, weed/pest
  reservoir), or
- **spray anyway** → risk a drift incident: the neighbour's decertification, fines, a
  lawsuit.

This is real, documented and regulated — the service ships *with a disclaimer instead of
a promise.* **Validated** through public EU/German drift-buffer regulation, not assumed.

## ✅ Our solution & value proposition

AgroSpray AI carries the GPS uncertainty **into the decision**. Every fix is treated as a
**point plus an error radius**, and for each of the 6 boom nozzles it sprays **only if it
is statistically confident (95%) that the spray cannot drift across the line**:

```
spray a nozzle  ⟺  P(drift across the line) ≤ chosen risk
buffer = z·σ(GNSS) + drift(boom height) + reaction(speed) + downwind(wind)
```

**The flip — same flight, same field, driven by the real Zurich Urban-MAV GNSS error:**

| | 5 m standard | 1 m corrected (Galileo HAS) |
|---|---|---|
| Boom along the organic line | cuts early / **off-target drift** | **sprays to the fence** |
| Border reclaimed | baseline | **+5,040 m²** this run |
| Crop-seam confusion (wrong chemical) | **266 fixes** | **6** |
| Boundary breach | **€50,000 fine risk** | none |

**In plain language:** at 5 m you lose the border or risk fines; at 1 m you spray right
to the legal line, put the right chemical on the right crop, and it's provable — no black
box. That is what EWIA's one-metre positioning unlocks, and AgroSpray AI is the layer
that turns it into a legal, profitable, automated decision.

---

## 🖥️ What's in the demo

Six live modules, all driven by one decision engine and a **5 m ↔ 1 m toggle**:

- **Command Center** — live per-nozzle spray/cut, KPIs, mini-map twin
- **Field Twin (3D)** — drones flying crop rows; blue = on-target, red = wasted on soil,
  crimson = drift across the line
- **AI Briefing** — plain-text reasoning + clickable live inputs (GPS, geodata,
  geo_core math) and an audit-CSV export — **no black box**
- **Cost saving** — the business case with a venture/market breakdown
- **Fleet & Airspace** — live controls (height, speed, wind, confidence) + multi-drone
- **Playback** — replay the flight and watch the decision flip

Built on **real geodata** (OpenStreetMap farmland) and the kit's **real Zurich GNSS
error**; positions are simulated, the world is real.

## 🚀 Run it locally

```bash
cd agrospray-app
npm install
npm run dev        # http://localhost:5173

# offline proof (Python): prints the flip + writes the audit logs
cd ../agrospray
python generate_field_track.py && python engine.py
```

A deeper technical write-up lives in [`agrospray/README.md`](agrospray/README.md).

---

*Built for the EWIA.tech "Down to the Meter" challenge — finding what only becomes
possible when positioning comes down to one metre.* 🛰️
