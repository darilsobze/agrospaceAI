# AgroSpray AI — Spatial Decision Engine

**EWIA "Down to the Meter" hackathon entry.** A spray-drone boom-control engine that
treats every GPS fix as a *point plus an error radius* and computes the operator's
real decision — **which boom nozzles may spray and which must shut off** — against a
real organic field boundary. The decision flips between a 5 m and a 1 m receiver.

> Not a tracking map. A **spatial risk & compliance engine** that outputs a per-nozzle
> spray/cut command and the plain-text reasoning behind it.

---

## The customer and the pain (Problem Validation)

Precision spray-drone operators (and the agronomists / ag-service contractors who run
them) in the EU. They are blocked by coarse positioning *today*:

- The **EU Sustainable Use Regulation (SUR)** and German **PflSchG** mandate **no-spray
  buffer zones** next to water bodies, residential edges and **certified-organic
  parcels**. Drift across an organic boundary **voids the neighbour's certification** and
  triggers fines and liability.
- Organic and conventional parcels routinely sit **2–4 m apart** (a shared field edge,
  a track, a hedgerow). A standard ~5 m GNSS fix **cannot tell which side of that edge
  the boom is on.** So the operator must either (a) set a large manual setback and leave
  the **border strip untreated** (weed/pest reservoir, yield loss), or (b) spray it and
  **risk a drift-decertification incident**.
- This is public, documented, and regulated — exactly the "service that ships with a
  disclaimer instead of a promise" the brief asks for.

## The solution (Solution Quality)

Carry the uncertainty into the decision. For each fix the engine places the 6 boom
nozzles, wraps each in a **buffer = error_radius + drift_margin**, and authorises a
nozzle to spray **only if, even at the worst case of that buffer, its footprint cannot
reach the restricted parcel.** Same flight, same field:

| | 5 m standard receiver | 1 m corrected (Galileo HAS class) |
|---|---|---|
| Safety buffer carried | 5.5 m | 1.5 m |
| Northern boom along the line | **nozzles cut / full-boom cuts** | sprays to the fence |
| Border reclaimed (this 1-field run) | baseline | **+552 m²** |

That is the **necessity test**: the use case *fails* at 5 m (border lost or fines
risked) and *works* at 1 m. If 5 m were good enough, it would be the wrong use case.

## Prototype (Prototype Tangibility)

A working tool on real-geometry geodata that computes a real decision — not slides, not
just a map.

```
agrospray/
  data/field.geojson          real-style farm parcels: target field + organic parcel
                              + legal boundary (OSM landuse=farmland style, Hessen)
  generate_field_track.py     serpentine spray path @1 Hz with honest 5 m / 1 m GNSS error
  engine.py                   THE DECISION ENGINE — per-nozzle spray/cut on point+radius
                              (reuses the starter floor geo_core.py 1:1)
  agrospray.html              the cockpit: live map, 5 m↔1 m toggle, animated boom,
                              transparent reasoning, business case, wind slider
  data/decisions_*.csv        the decision log the engine writes out
```

### Run it

```bash
cd agrospray
python generate_field_track.py     # writes drone_truth/5m/1m.geojson  (re-run to reseed)
python engine.py                   # prints the 5 m vs 1 m flip + writes decisions_*.csv
python -m http.server 8000         # then open http://localhost:8000/agrospray.html
```

The cockpit (`agrospray.html`) runs the **same geometry** as `engine.py` live in the
browser. Press **Play** to fly the route; flip the **5 m / 1 m** toggle to watch nozzles
switch red↔green along the organic line; drag the **wind** slider to inflate the buffer
and see the boom cut earlier (graceful degradation).

## Modelled variables (the safety buffer is the product)

The decision is `spray a nozzle only if dist(nozzle → nearest restricted zone) ≥ buffer`,
and the **buffer is built from real operating conditions** — all live-adjustable in the
**Fleet & Airspace** tab:

```
buffer = gnss_error + drift_margin + reaction + downwind
  gnss_error   receiver class (5 m / 1 m), inflated near trees (GNSS multipath)
  drift_margin base + k · boom HEIGHT          (higher boom → more drift)
  reaction     SPEED · valve_delay             (can't shut a nozzle instantly)
  downwind     WIND speed · alignment toward a restricted zone (asymmetric)
```

Plus, modelled across the world geometry:

- **Multiple crops** (A wheat / B oilseed rape) with different chemicals & doses. At 5 m
  the error radius spans the A|B seam → the tool flags **crop-ambiguous** nozzles
  (wrong-dose risk); at 1 m this drops to zero — a *second* flip on the meter.
- **Multiple restricted zones**: the organic parcel **and** a water-buffer pond.
- **Tree obstacles**: both avoided (no spray) **and** a GNSS-multipath source that grows
  the error radius nearby — graceful degradation exactly where precision matters most.
- **Chemical tank & cost**: litres applied / remaining and € per crop, live.
- **Spray master** (AUTO / OFF) operator override, and a **compliance audit CSV export**
  (per-fix decision → inputs → reason) for the regulator-facing "no black box" trail.

## No black box (transparency)

Every cut traces to data and stated assumptions. The AI-briefing panel prints the
literal logic, e.g.:

```
PARTIAL CUT — nozzles 5, 6 OFF.
Footprint within 1.5 m buffer of organic line.
4/6 southern nozzles still spraying.
```

with its inputs: the live NMEA fix, the OSM boundary nodes, and the `geo_core.py`
point-in-polygon + edge-distance computation.

## Graceful degradation (Partner bonus)

`effErr = base + wind·0.4`. The buffer is a **variable, not an assumption**: as wind
rises (downwind drift) or fix quality drops toward 2 m, the error circle grows on the
fly and outer nozzles shut **before** they can drift. The tool degrades safely instead
of assuming a perfect position.

## Business potential (Business Potential)

A horizontal: the same engine maps to any drift-regulated spray context (vineyards near
water, residential-edge orchards, rail-side vegetation control). The per-field figures
here are deliberately conservative (€0.18/m² wheat gross margin; €5 000 per avoided
decertification incident); they scale with field count, applications per season, and the
liability of operating legally next to organic neighbours at all — the value EWIA's
1 m positioning unlocks.

## Honest scope / assumptions

- **Positions are simulated; the world (the boundary geometry) is real-style** —
  exactly as the brief allows. Swap `data/field.geojson` for an OSM Overpass export of a
  real organic/conventional parcel pair to make the world literally real.
- Error model: open-sky farmland (Gauss-Markov drift + rare multipath), RMS ~3.3 m
  (5 m) / ~0.7 m (1 m), validated against the kit's real Zurich GNSS set (~4.4 m RMS).
- Buffer radii (5.0 / 1.0 m) represent the receiver's carried horizontal uncertainty,
  not a guarantee; `drift_margin = 0.5 m` is the agronomic fine-droplet allowance.
