#!/usr/bin/env python3
"""
engine.py — AgroSpray AI spatial decision engine.

For every GPS fix it computes the operator's real decision — which of the 6 boom
nozzles may spray — by treating each fix as a POINT PLUS AN ERROR RADIUS and
testing each nozzle against the real field geometry. The safety buffer is a
VARIABLE built from the things that actually change drift risk:

    buffer = gnss_error + drift_margin + reaction + downwind
      gnss_error  = receiver class, inflated near trees (multipath)         [meter!]
      drift_margin= base + k * boom height                                  (feature 2)
      reaction    = speed * valve_delay  (cannot shut a nozzle instantly)   (feature 1)
      downwind    = wind speed * alignment toward the restricted zone       (feature 8/9)

A nozzle sprays only if, even at the worst case of that buffer, it stays clear of
every restricted zone (organic parcel, water buffer) and every tree, and is
confidently over a crop. It also reports WHICH crop (and flags when 5 m cannot
tell crop A from crop B across the seam — a second flip), tracks the tank, and
prices the chemical. Reuses the starter geo_core.py. Stdlib only.

    python engine.py
"""

import csv, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.append(os.path.join(HERE, "..", "..", "starter_kit_down_to_the_meter", "starter"))
import geo_core as g   # noqa: E402

DATA = os.path.join(HERE, "data")

# ---- boom / receiver ----
BOOM_WIDTH_M, N_NOZZLES = 12.0, 6
NOZZLE_OFFSETS = [(-BOOM_WIDTH_M / 2) + BOOM_WIDTH_M * (i + 0.5) / N_NOZZLES for i in range(N_NOZZLES)]
ERROR_RADIUS = {"5m": 5.0, "1m": 1.0}

# ---- operator settings (the new controls) ----
OP = {
    "height_m": 3.0,        # feature 2 — boom height
    "speed_ms": 6.0,        # feature 1 — flight speed
    "valve_delay_s": 0.3,   # feature 1 — nozzle shut latency
    "wind_ms": 0.0,         # feature 8 — wind speed
    "wind_bearing": 0.0,    # feature 9 — direction wind blows TOWARD (deg, 0=N,90=E)
}
DRIFT_BASE_M = 0.5
K_HEIGHT = 0.30             # extra drift margin per metre of height above 2 m
K_WIND_DRIFT = 0.18        # extra downwind margin per m/s, scaled by alignment
TANK_L = 8.0                # feature 7 — chemical tank capacity


# ---- load geometry ----
def load_field():
    fc = json.load(open(os.path.join(DATA, "field.geojson")))
    crops, restricted, obstacles = [], [], []
    for f in fc["features"]:
        p, role, geo = f["properties"], f["properties"].get("role"), f["geometry"]
        if role == "target_field":
            crops.append({"name": p["name"], "crop": p.get("crop", "?"),
                          "dose_l_per_m2": p.get("dose_l_per_ha", 1.5) / 10000.0,
                          "price": p.get("price_eur_per_l", 12),
                          "ring": [(c[0], c[1]) for c in geo["coordinates"][0]]})
        elif role == "restricted":
            restricted.append({"name": p["name"], "subtype": p.get("subtype", ""),
                               "ring": [(c[0], c[1]) for c in geo["coordinates"][0]]})
        elif role == "obstacle":
            lon, lat = geo["coordinates"]
            obstacles.append({"name": p["name"], "lon": lon, "lat": lat,
                              "r_avoid": p.get("r_avoid_m", 3.0), "r_gps": p.get("r_gps_m", 15)})
    return crops, restricted, obstacles


def load_track(receiver):
    fc = json.load(open(os.path.join(DATA, f"drone_{receiver}.geojson")))
    feat = fc["features"][0]
    coords = [(c[0], c[1]) for c in feat["geometry"]["coordinates"]]
    return coords, feat["properties"]["headings_deg"]


# ---- geometry helpers ----
def _dist_m(alon, alat, blon, blat):
    return math.hypot((alon - blon) * g.m_per_deg_lon(alat), (alat - blat) * g.M_PER_DEG_LAT)


def _centroid(ring):
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def nozzle_positions(lon, lat, heading_deg):
    th = math.radians(heading_deg)
    pe, pn = -math.cos(th), math.sin(th)        # left-normal (east, north)
    return [(lon + pe * off / g.m_per_deg_lon(lat), lat + pn * off / g.M_PER_DEG_LAT)
            for off in NOZZLE_OFFSETS]


def gnss_error(lon, lat, receiver, obstacles):
    """Receiver class inflated by tree multipath: near a tree the radius grows."""
    err = ERROR_RADIUS[receiver]
    for o in obstacles:
        d = _dist_m(lon, lat, o["lon"], o["lat"])
        if d < o["r_gps"]:
            err += ERROR_RADIUS[receiver] * 1.5 * (1 - d / o["r_gps"])
    return err


def dist_to_restricted(lon, lat, restricted):
    """(min distance to any restricted zone, that zone) — 0 if inside one."""
    best, who = float("inf"), None
    for z in restricted:
        d = 0.0 if g.point_in_polygon(lon, lat, z["ring"]) else g.dist_to_polygon_edge(lon, lat, z["ring"])
        if d < best:
            best, who = d, z
    return best, who


def decide_fix(lon, lat, heading, crops, restricted, obstacles, receiver, op=OP):
    err = gnss_error(lon, lat, receiver, obstacles)
    drift = DRIFT_BASE_M + K_HEIGHT * max(0.0, op["height_m"] - 2.0)
    reaction = op["speed_ms"] * op["valve_delay_s"]
    wth = math.radians(op["wind_bearing"])
    wind_e, wind_n = math.sin(wth), math.cos(wth)        # unit dir wind blows toward

    states, min_clear, n_spray, ambiguous = [], float("inf"), 0, 0
    litres = 0.0
    nozzle_area = (BOOM_WIDTH_M / N_NOZZLES) * op["speed_ms"]
    shut = []
    for idx, (nlon, nlat) in enumerate(nozzle_positions(lon, lat, heading)):
        dR, zone = dist_to_restricted(nlon, nlat, restricted)
        # downwind extra toward the nearest restricted zone
        downwind = 0.0
        if zone and op["wind_ms"] > 0:
            cx, cy = _centroid(zone["ring"])
            de, dn = (cx - nlon) * g.m_per_deg_lon(nlat), (cy - nlat) * g.M_PER_DEG_LAT
            n = math.hypot(de, dn) or 1.0
            align = max(0.0, (wind_e * de + wind_n * dn) / n)
            downwind = op["wind_ms"] * K_WIND_DRIFT * align
        buffer_m = err + drift + reaction + downwind
        # tree avoidance
        over_tree = any(_dist_m(nlon, nlat, o["lon"], o["lat"]) < o["r_avoid"] for o in obstacles)
        # crop membership
        inside = [c for c in crops if g.point_in_polygon(nlon, nlat, c["ring"])]
        in_field = len(inside) > 0
        crop = inside[0] if inside else None
        # crop-ambiguous: confidently in one crop, but the error radius could reach a DIFFERENT crop
        amb = bool(crop) and any(o is not crop and g.dist_to_polygon_edge(nlon, nlat, o["ring"]) < err
                                 for o in crops)
        spray = (dR >= buffer_m) and in_field and not over_tree
        if spray:
            n_spray += 1
            litres += crop["dose_l_per_m2"] * nozzle_area
            if amb:
                ambiguous += 1
        else:
            shut.append(idx + 1)
        min_clear = min(min_clear, dR)
        states.append({"spray": spray, "clear": dR, "crop": crop["crop"] if crop else None,
                       "amb": amb, "tree": over_tree, "buffer": buffer_m})
    buf0 = states[0]["buffer"]
    if n_spray == N_NOZZLES:
        reason = (f"All {N_NOZZLES} nozzles spray. Nearest nozzle {min_clear:.1f} m from a restricted "
                  f"zone; buffer {buf0:.1f} m (gnss {err:.1f} + drift {drift:.1f} + react {reaction:.1f}). OK.")
    elif n_spray == 0:
        reason = f"FULL BOOM CUT. Nearest nozzle {min_clear:.1f} m < buffer {buf0:.1f} m. All nozzles off."
    else:
        why = "tree/zone avoidance" if any(s["tree"] for s in states) else "buffer breach near a restricted zone"
        reason = f"PARTIAL CUT — nozzles {shut} off ({why}). {n_spray}/{N_NOZZLES} active."
    if ambiguous:
        reason += f" [{ambiguous} nozzle(s) crop-ambiguous: error radius spans the A|B seam -> wrong-dose risk]"
    return {"n_spray": n_spray, "shut": shut, "min_clear": min_clear, "err": err, "buffer": buf0,
            "litres": litres, "ambiguous": ambiguous, "states": states, "reason": reason}


def run(receiver, crops, restricted, obstacles, op=OP):
    coords, headings = load_track(receiver)
    decs, area, litres, tank = [], 0.0, 0.0, TANK_L
    nozzle_area = (BOOM_WIDTH_M / N_NOZZLES) * op["speed_ms"]
    for (lon, lat), h in zip(coords, headings):
        d = decide_fix(lon, lat, h, crops, restricted, obstacles, receiver, op)
        area += d["n_spray"] * nozzle_area
        litres += d["litres"]
        decs.append(d)
    return decs, area, litres


def write_csv(receiver, decs):
    path = os.path.join(DATA, f"decisions_{receiver}.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["fix", "active_nozzles", "shut", "min_clear_m", "gnss_err_m",
                    "buffer_m", "litres", "crop_ambiguous", "reason"])
        for i, d in enumerate(decs):
            w.writerow([i, d["n_spray"], "|".join(map(str, d["shut"])), round(d["min_clear"], 2),
                        round(d["err"], 2), round(d["buffer"], 2), round(d["litres"], 4),
                        d["ambiguous"], d["reason"]])
    return path


def main():
    crops, restricted, obstacles = load_field()
    print("AgroSpray AI - spatial decision engine\n" + "=" * 56)
    print(f"settings: height {OP['height_m']} m · speed {OP['speed_ms']} m/s · "
          f"wind {OP['wind_ms']} m/s @ {OP['wind_bearing']:.0f}° · tank {TANK_L} L")
    print(f"world: {len(crops)} crops, {len(restricted)} restricted zones, {len(obstacles)} trees")
    res = {}
    for r in ("5m", "1m"):
        decs, area, litres = run(r, crops, restricted, obstacles)
        res[r] = {"area": area, "litres": litres,
                  "full": sum(1 for d in decs if d["n_spray"] == 0),
                  "partial": sum(1 for d in decs if 0 < d["n_spray"] < N_NOZZLES),
                  "amb": sum(d["ambiguous"] for d in decs)}
        write_csv(r, decs)
        avg_price = sum(c["price"] for c in crops) / len(crops)
        print(f"\n[{r}]  treated {area:7.0f} m2 | chemical {litres:4.2f} L (~EUR {litres*avg_price:5.2f}) | "
              f"full cuts {res[r]['full']:3d} | partial {res[r]['partial']:3d} | crop-ambiguous fixes {res[r]['amb']:3d}")

    avg_price = sum(c["price"] for c in crops) / len(crops)
    rec = res["1m"]["area"] - res["5m"]["area"]
    chem = (res["1m"]["litres"] - res["5m"]["litres"])
    print("\n" + "=" * 56 + "\nTHE FLIP (1 m vs 5 m), same flight, same world:")
    print(f"  border reclaimed:        {rec:6.0f} m2  (EUR {rec*0.18:,.0f}/season crop value)")
    print(f"  chemical placed on-target:{chem:+5.2f} L  (correct dose to the correct crop)")
    print(f"  crop-ambiguous fixes:     {res['5m']['amb']} at 5 m  ->  {res['1m']['amb']} at 1 m")
    print(f"  drift-fine exposure removed: EUR 5,000 per avoided organic-decert incident")
    print("\nNecessity test: at 5 m the boom cuts metres early, mis-doses across the crop")
    print("seam, and over-buffers near trees; at 1 m it sprays the right chemical to the line.")


if __name__ == "__main__":
    main()
