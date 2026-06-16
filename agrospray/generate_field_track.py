#!/usr/bin/env python3
"""
generate_field_track.py — a spray-drone serpentine over the real field geometry,
sampled at 1 Hz, carrying REAL GNSS error replayed from a real drone flight.

The drone mows the target field in East-West passes, South -> North, so the LAST
passes run right along the organic boundary. That is exactly where the meter bites.

Error model: the 5 m track carries the REAL horizontal error from the Zurich Urban
MAV dataset (data/real/zurich_agz_groundtruth.csv, on-board GPS minus ground truth,
RMS ~4.4 m, max ~24 m real urban multipath) replayed onto our route. The 1 m track
carries the SAME real error profile scaled to a corrected-receiver magnitude
(~1 m RMS, Galileo HAS class). Positions are simulated; the ERROR is real.

Writes into agrospray/data/:
  drone_truth.geojson   the true flown path
  drone_5m.geojson      standard receiver — REAL Zurich error (~4.4 m RMS)
  drone_1m.geojson      corrected receiver — same real profile, ~1 m RMS

    python generate_field_track.py
"""

import csv, json, math, os

M_PER_DEG_LAT = 111320.0
def m_per_deg_lon(lat): return M_PER_DEG_LAT * math.cos(math.radians(lat))

HERE = os.path.dirname(os.path.abspath(__file__))
REAL_CSV = os.path.join(HERE, "data", "real", "zurich_agz_groundtruth.csv")

# target RMS (m) we want each receiver class to carry; 5 m uses the real error as-is
TARGET_RMS = {"5m": None, "1m": 1.0}

# --- field geometry (must match data/field.geojson) — Oostelijk Flevoland farmland ---
LON_W, LON_E = 5.5170000, 5.5228524          # ~400 m East-West
LAT_S, LAT_N = 52.4530000, 52.4558745        # ~320 m North-South; LAT_N = organic boundary

SWATH_M   = 12.0     # boom width -> pass spacing
SPEED_MS  = 6.0      # spray speed
DT        = 1.0


def build_truth():
    """Serpentine of E-W passes, S->N, spaced one swath apart. The northernmost
    pass is centred half a swath below the organic boundary, so the boom's north
    edge reaches the fence line. Returns [(lon, lat, heading_deg)]."""
    span_ns = (LAT_N - LAT_S) * M_PER_DEG_LAT
    n_pass = int(span_ns // SWATH_M)
    # Anchor the TOP pass half a swath below the organic boundary, so the boom's
    # north edge reaches the fence line — the agronomist sprays as close as allowed.
    pass_lats = [LAT_N - (SWATH_M / 2 + k * SWATH_M) / M_PER_DEG_LAT for k in range(n_pass)]
    pass_lats.reverse()   # fly South -> North, finish along the boundary
    samples = []
    for k, lat in enumerate(pass_lats):
        west_to_east = (k % 2 == 0)
        a_lon, b_lon = (LON_W, LON_E) if west_to_east else (LON_E, LON_W)
        heading = 90.0 if west_to_east else 270.0   # bearing; 90=E, 270=W
        seg_m = abs(b_lon - a_lon) * m_per_deg_lon(lat)
        steps = max(1, int(seg_m / (SPEED_MS * DT)))
        for s in range(steps + 1):
            f = s / steps
            samples.append((a_lon + (b_lon - a_lon) * f, lat, heading))
    return samples


def load_real_errors(path=REAL_CSV):
    """Real horizontal GNSS error vectors (east_m, north_m) = on-board GPS minus
    ground truth, in metres (UTM). Cols (0-indexed): x_gt=1, y_gt=2, x_gps=7, y_gps=8."""
    errs = []
    with open(path) as f:
        for row in csv.reader(f):
            if len(row) < 9:
                continue
            try:
                x_gt, y_gt = float(row[1]), float(row[2])
                x_gps, y_gps = float(row[7]), float(row[8])
            except (ValueError, IndexError):
                continue
            errs.append((x_gps - x_gt, y_gps - y_gt))
    return errs


def rms_of(errs):
    return math.sqrt(sum(dx * dx + dy * dy for dx, dy in errs) / len(errs))


def make_noisy(truth, receiver, errs, real_rms):
    """Replay the REAL error sequence (cycling) onto our route. The 5 m receiver
    carries it as-is; the 1 m receiver carries the same profile scaled to ~1 m RMS,
    so both reflect the real error shape — only the magnitude (the meter) differs."""
    scale = 1.0 if TARGET_RMS[receiver] is None else TARGET_RMS[receiver] / real_rms
    n = len(errs)
    out = []
    for i, (lon, lat, hdg) in enumerate(truth):
        de, dn = errs[i % n]
        out.append((lon + de * scale / m_per_deg_lon(lat),
                    lat + dn * scale / M_PER_DEG_LAT, hdg))
    return out


def to_geojson(coords, name):
    return {"type": "FeatureCollection", "features": [{
        "type": "Feature",
        "properties": {"name": name, "samples": len(coords), "dt_s": DT,
                       "headings_deg": [round(c[2], 1) for c in coords]},
        "geometry": {"type": "LineString",
                     "coordinates": [[round(c[0], 7), round(c[1], 7)] for c in coords]}}]}


def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    os.makedirs(out, exist_ok=True)
    truth = build_truth()
    errs = load_real_errors()
    real_rms = rms_of(errs)
    print(f"real Zurich error: {len(errs)} fixes, RMS {real_rms:.2f} m, max "
          f"{max(math.hypot(*e) for e in errs):.2f} m")
    json.dump(to_geojson(truth, "truth"), open(os.path.join(out, "drone_truth.geojson"), "w"))
    for r in ("5m", "1m"):
        noisy = make_noisy(truth, r, errs, real_rms)
        json.dump(to_geojson(noisy, f"gnss_{r}"), open(os.path.join(out, f"drone_{r}.geojson"), "w"))
        mags = [math.hypot((noisy[i][0] - truth[i][0]) * m_per_deg_lon(truth[i][1]),
                           (noisy[i][1] - truth[i][1]) * M_PER_DEG_LAT) for i in range(len(truth))]
        rms = math.sqrt(sum(e * e for e in mags) / len(mags))
        print(f"drone_{r}: {len(noisy)} fixes, RMS {rms:.2f} m, max {max(mags):.2f} m")
    print(f"wrote {len(truth)} fixes to agrospray/data/ (truth, 5m, 1m)")


if __name__ == "__main__":
    main()
