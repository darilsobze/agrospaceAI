# 🌾 AgroSpray AI — Spray to the Meter

### *The boom-control copilot that lets a spray drone treat every last metre of a field — without a single drop crossing the organic line next door.*

> **EWIA.tech "Down to the Meter" hackathon entry.**
> A precision-agriculture decision engine that turns 1-metre satellite positioning
> into a legal, profitable, and provable spray operation. Not a map — a **per-nozzle
> spray/cut decision** computed live from the drone's position *and its uncertainty*.

---

## 🎯 The use case

A spray drone is treating a conventional field. Sharing its northern edge is a
**certified-organic field**. By EU law (the Sustainable Use Regulation) and German
**PflSchG** buffer-zone rules, **not one droplet** may drift across that boundary — if it
does, the neighbour **loses their organic certification** and the operator faces fines and
liability. Next to the field there's also a **water-buffer pond** (no spray) and **trees**
that both block the drone and scramble its GPS.

The operator (a precision-ag drone contractor) lives or dies on one question, taken
**six times a second, once per nozzle**:

> *"Can I prove this nozzle won't spray where it must not?"*

---

## ❗ The problem — why this fails today

A standard drone GPS is accurate to **about 5 metres**. Organic and conventional parcels
sit **2–4 metres apart**. **At 5 m, the drone literally cannot tell which side of the
boundary it is on.** So the operator is forced to choose:

- **Play it safe** → cut the boom metres early. The **field border goes untreated** — a
  weed and pest reservoir, lost yield, wasted land.
- **Spray it anyway** → risk a **drift incident**: the neighbour's decertification, fines,
  a lawsuit. The service ships *with a disclaimer instead of a promise.*

This is real, documented, and regulated. It is exactly the trap the challenge describes:
**a few metres of error quietly break the operation.**

---

## ✅ The solution — accuracy as a variable

AgroSpray AI carries the uncertainty **into the decision**. Every GPS fix is treated as a
**point plus an error radius**. For each of the 6 boom nozzles it computes a live
**safety buffer** and sprays **only if the worst case still stays clear**:

```
spray a nozzle  ⟺  distance(nozzle → nearest restricted zone)  ≥  buffer

buffer = gnss_error + drift_margin(boom height) + reaction(speed) + downwind(wind)
         └─ 5 m vs 1 m ─┘   └─ higher = more drift ─┘  └ can't stop instantly ┘  └ asymmetric ┘
```

**The flip — same flight, same field:**

| | **5 m standard** | **1 m corrected (Galileo HAS)** |
|---|---|---|
| Safety buffer | ~5.5 m | ~1.5 m |
| Border along the organic line | **boom cut early / full cuts** | **sprays to the fence** |
| Border reclaimed | baseline | **+996 m²** this field/run |
| Crop-seam confusion (wrong chemical) | **106 ambiguous fixes** | **0** |

At 5 m it fails the necessity test; at 1 m it works. **That is the meter.**

---

## 🖥️ The software — what we built

A working tool on **real-style farm geodata**, not slides. Six live modules, all driven by
the same engine and a **5 m ↔ 1 m toggle**:

| Module | What it shows |
|---|---|
| **01 · Command Center** | The live action ("disabling nozzles 5 & 4 to protect the organic parcel"), KPIs, the 6-nozzle boom state, and a mini-map twin. |
| **02 · Field Twin (3D)** | A 3D farm: blocky crop rows (gold wheat / green rape) on tilled soil, the drone flying with **spray cones**, a **teal spray trail** filling in, per-crop **GPS beacons**, and a **heading arrow + path preview**. |
| **03 · AI Briefing** | The plain-text reasoning behind every cut + its inputs (NMEA fix, OSM boundary, geometry) — **no black box** — with a **compliance audit CSV export**. |
| **04 · Follow vs Ignore** | The business case: € value preserved, border reclaimed, wrong-dose risk removed. |
| **05 · Fleet & Airspace** | Live operator controls — **height, speed, wind speed + direction**, tank level, and chemical cost. |
| **06 · Playback** | Replay the flight; flip the receiver and watch the decision flip. |

It also models **multiple crops** (different chemicals/doses — at 5 m the A\|B seam is
ambiguous), **multiple no-spray zones** (organic + water), **tree obstacles** that inflate
GPS error nearby (graceful degradation), and a **chemical tank + cost** calculator.

**Two front-ends, same engine:**
- `agrospray/` — a zero-build single-file demo (`python -m http.server`) + a **Python
  `engine.py`** that prints the flip and writes the audit logs (the offline proof).
- `agrospray-app/` — the production **React + TypeScript + Tailwind** app, deployable to
  Vercel.

---

## 🎤 Live demo script (≈5 minutes)

**[0:00 — The hook]**
"Most of the digital world is happy with five-metre GPS. Maps, food delivery — five metres
is fine. But meet someone for whom five metres is a lawsuit: a spray-drone operator next
to an organic field. Watch."

**[0:30 — Command Center, 1 m]**
"This is AgroSpray AI. The drone is spraying our field. Green nozzles are spraying, and it's
going right up to the organic boundary — this red line. Every second it's making a
per-nozzle decision. Down here: all six nozzles active, spraying to the line."

**[1:15 — Flip to 5 m]** *(click the 5 m toggle)*
"Now the exact same flight on a standard five-metre receiver. Watch the boom." *(nozzles go
red along the border)* "It's cutting nozzles four, five and six — metres early — because at
five metres it **cannot prove** it won't drift. That untreated strip? Lost yield, every
season, the length of every organic border on the farm."

**[2:00 — Field Twin 3D]**
"Here's the same run in 3D. The blue cones are live spray; the **teal trail** is what's been
treated. Flip to one metre…" *(toggle)* "…and the trail closes right up to the fence. The
pale border at five metres just disappeared. That's 996 square metres reclaimed on **one
field, one pass.**"

**[2:45 — AI Briefing]**
"The judges said no black box. Every cut is traceable: nearest nozzle 1.2 m from the line,
buffer 1.5 m, margin verified. Inputs: the live GPS fix, the OpenStreetMap boundary, our
geometry. One click exports the full per-fix audit trail for the regulator."

**[3:30 — Fleet controls / graceful degradation]**
"And the buffer is a **variable**, not an assumption. Raise the wind…" *(drag slider)* "…and
only the downwind nozzles cut earlier. Fly near a tree and the GPS error inflates, so the
boom backs off **before** it drifts. It degrades safely — it never blindly sprays."

**[4:15 — Follow vs Ignore / close]**
"Follow the meter: spray to the line, right chemical to the right crop, full compliance.
Ignore it: untreated borders, wrong doses, decertification. EWIA's one-metre positioning
is what unlocks this — and AgroSpray AI is the layer that turns it into a legal, profitable
decision. **Down to the meter.** Thank you."

---

## 🚀 Run it

```bash
# Production React app
cd agrospray-app && npm install && npm run dev      # http://localhost:5173

# Zero-build demo + Python proof
cd agrospray
python generate_field_track.py    # simulate the flight (5 m + 1 m tracks)
python engine.py                  # prints the flip, writes audit CSVs
python -m http.server 8000        # open http://localhost:8000/agrospray.html
```

---

## 📐 Honest scope

Positions are **simulated**; the world (the parcel geometry) is **real-style**, exactly as
the brief allows — swap `field.geojson` for an OpenStreetMap export to make it literally
real. The GNSS error model is validated against the kit's real Zurich drone dataset
(~4.4 m RMS). Buffer radii represent carried uncertainty, not a guarantee; every safety
claim traces to data and stated assumptions. Economic figures are deliberately conservative
and labelled as estimates.

---

*Built for the EWIA.tech "Down to the Meter" challenge — finding what only becomes possible
when positioning comes down to one metre.* 🛰️
