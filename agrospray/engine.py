#!/usr/bin/env python3
"""
engine.py — AgroSpray AI spatial decision engine.

This is the heart of the tool: it does NOT just draw a map. For every GPS fix on
the drone's path it computes the operator's real decision — which boom nozzles may
spray and which must shut off — by treating each fix as a POINT PLUS AN ERROR
RADIUS and testing each nozzle's drift footprint against the real organic boundary.

The whole challenge in one line:
    shut a nozzle if   distance(nozzle -> restricted parcel) < error_radius + drift_margin
i.e. spray only when we are CONFIDENT, even at the worst case of our uncertainty,
that no chemical crosses the legal line. The error_radius is ~5 m for a standard
receiver and ~1 m for a corrected one — so the same flight, same geometry, yields a
different decision. That is the meter.

Reuses the starter floor geometry (geo_core.py): point_in_polygon,
dist_to_polygon_edge, could_be_inside. No third-party dependencies.

    python engine.py            # 5 m vs 1 m comparison + writes decisions_*.csv
"""

import csv, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
# geo_core.py is vendored alongside this file (a copy of the starter floor), so the
# repo is self-contained; fall back to the starter kit location if present.
sys.path.insert(0, HERE)
sys.path.append(os.path.join(HERE, "..", "..", "starter_kit_down_to_the_meter", "starter"))
import geo_core as g   # noqa: E402

DATA = os.path.join(HERE, "data")

# --- boom / agronomic model ---
BOOM_WIDTH_M   = 12.0
N_NOZZLES      = 6
DRIFT_MARGIN_M = 0.5     # agronomic safety: fine-droplet drift beyond the nozzle
# cross-track offsets of each nozzle from drone centre (m); + is to the LEFT of heading
NOZZLE_OFFSETS = [(-BOOM_WIDTH_M / 2) + BOOM_WIDTH_M * (i + 0.5) / N_NOZZLES
                  for i in range(N_NOZZLES)]

# receiver -> base 1-sigma-ish error radius we carry as the safety buffer (m)
ERROR_RADIUS = {"5m": 5.0, "1m": 1.0}

# economics (conservative, sourced in README)
VALUE_PER_M2   = 0.18    # € gross margin per m2 of treated winter wheat / season
DRIFT_FINE_EUR = 5000.0  # one organic-decertification / drift incident


def load_field():
    fc = json.load(open(os.path.join(DATA, "field.geojson")))
    field = restricted = None
    for f in fc["features"]:
        role = f["properties"].get("role")
        if role == "target_field":
            field = [(c[0], c[1]) for c in f["geometry"]["coordinates"][0]]
        elif role == "restricted_parcel":
            restricted = [(c[0], c[1]) for c in f["geometry"]["coordinates"][0]]
    return field, restricted


def load_track(receiver):
    fc = json.load(open(os.path.join(DATA, f"drone_{receiver}.geojson")))
    feat = fc["features"][0]
    coords = [(c[0], c[1]) for c in feat["geometry"]["coordinates"]]
    headings = feat["properties"]["headings_deg"]
    return coords, headings


def nozzle_positions(lon, lat, heading_deg):
    """World positions of each nozzle. Cross-track (perpendicular to heading) in m,
    converted to lon/lat. + offset is to the LEFT of travel."""
    th = math.radians(heading_deg)            # bearing: 0=N, 90=E
    # left-perpendicular unit vector in (east, north): rotate heading +90 deg
    pe, pn = -math.cos(th), math.sin(th)      # (east, north) of left-normal
    out = []
    for off in NOZZLE_OFFSETS:
        de, dn = pe * off, pn * off
        out.append((lon + de / g.m_per_deg_lon(lat), lat + dn / g.M_PER_DEG_LAT))
    return out


def decide_fix(lon, lat, heading, field, restricted, error_radius):
    """The decision for one fix. Returns dict with per-nozzle spray/shut and the
    plain-text reasoning (no black box)."""
    buffer_m = error_radius + DRIFT_MARGIN_M
    noz = nozzle_positions(lon, lat, heading)
    states, min_clear = [], float("inf")
    for (nlon, nlat) in noz:
        d_restricted = (0.0 if g.point_in_polygon(nlon, nlat, restricted)
                        else g.dist_to_polygon_edge(nlon, nlat, restricted))
        in_field = g.point_in_polygon(nlon, nlat, field) or \
                   g.dist_to_polygon_edge(nlon, nlat, field) < buffer_m
        # spray only if confident: worst-case footprint stays out of restricted AND in field
        spray = (d_restricted >= buffer_m) and in_field
        states.append({"spray": spray, "clear_m": d_restricted})
        min_clear = min(min_clear, d_restricted)
    n_spray = sum(s["spray"] for s in states)
    shut = [i + 1 for i, s in enumerate(states) if not s["spray"]]
    if n_spray == N_NOZZLES:
        reason = (f"All {N_NOZZLES} nozzles spray. Nearest nozzle is {min_clear:.1f} m "
                  f"from the organic line; safety buffer is {buffer_m:.1f} m "
                  f"(error {error_radius:.1f} m + drift {DRIFT_MARGIN_M:.1f} m). Margin OK.")
    elif n_spray == 0:
        reason = (f"FULL BOOM CUT. Nearest nozzle {min_clear:.1f} m from line < buffer "
                  f"{buffer_m:.1f} m. Cannot prove no drift; all nozzles off.")
    else:
        reason = (f"PARTIAL CUT — nozzles {shut} off. Their footprint is within the "
                  f"{buffer_m:.1f} m buffer of the organic line; southern nozzles still "
                  f"spray ({n_spray}/{N_NOZZLES} active).")
    return {"n_spray": n_spray, "shut": shut, "min_clear": min_clear,
            "buffer_m": buffer_m, "states": states, "reason": reason}


def run(receiver, field, restricted, error_radius=None):
    error_radius = ERROR_RADIUS[receiver] if error_radius is None else error_radius
    coords, headings = load_track(receiver)
    nozzle_area = (BOOM_WIDTH_M / N_NOZZLES) * (run.speed_ms)  # m2 sprayed per nozzle per fix
    decisions, treated_area = [], 0.0
    for (lon, lat), hdg in zip(coords, headings):
        d = decide_fix(lon, lat, hdg, field, restricted, error_radius)
        treated_area += d["n_spray"] * nozzle_area
        decisions.append(d)
    return decisions, treated_area
run.speed_ms = 6.0   # matches generator DT*SPEED


def summarize(receiver, decisions, treated_area):
    full_cut = sum(1 for d in decisions if d["n_spray"] == 0)
    partial  = sum(1 for d in decisions if 0 < d["n_spray"] < N_NOZZLES)
    return {"receiver": receiver, "fixes": len(decisions),
            "treated_m2": treated_area, "full_cut_fixes": full_cut,
            "partial_cut_fixes": partial}


def write_csv(receiver, decisions):
    path = os.path.join(DATA, f"decisions_{receiver}.csv")
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["fix", "active_nozzles", "shut_nozzles", "min_clearance_m",
                    "buffer_m", "reason"])
        for i, d in enumerate(decisions):
            w.writerow([i, d["n_spray"], "|".join(map(str, d["shut"])),
                        round(d["min_clear"], 2), d["buffer_m"], d["reason"]])
    return path


def main():
    field, restricted = load_field()
    print("AgroSpray AI - spatial decision engine\n" + "=" * 52)
    results = {}
    for r in ("5m", "1m"):
        decisions, area = run(r, field, restricted)
        s = summarize(r, decisions, area)
        results[r] = s
        path = write_csv(r, decisions)
        print(f"\n[{r} receiver]  buffer = {ERROR_RADIUS[r] + DRIFT_MARGIN_M:.1f} m")
        print(f"  fixes:            {s['fixes']}")
        print(f"  full-boom cuts:   {s['full_cut_fixes']}")
        print(f"  partial cuts:     {s['partial_cut_fixes']}")
        print(f"  treated area:     {s['treated_m2']:.0f} m2")
        print(f"  decision log ->   {os.path.relpath(path, HERE)}")

    # the flip, in numbers
    reclaimed = results["1m"]["treated_m2"] - results["5m"]["treated_m2"]
    print("\n" + "=" * 52 + "\nTHE FLIP (1 m vs 5 m), same flight, same field:")
    print(f"  extra crop treated at 1 m:  {reclaimed:.0f} m2 of legal border reclaimed")
    print(f"  value of that border:       EUR {reclaimed * VALUE_PER_M2:,.0f} / season")
    print(f"  drift-fine exposure removed: EUR {DRIFT_FINE_EUR:,.0f} per avoided incident")
    print("\nNecessity test: at 5 m the boom must cut metres early (border left")
    print("untreated) to stay provably clear; at 1 m it sprays to the fence line.")


if __name__ == "__main__":
    main()
