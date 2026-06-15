#!/usr/bin/env python3
"""
generate_field_track.py — a spray-drone serpentine over the real field geometry,
sampled at 1 Hz, with honest open-sky GNSS error for a 5 m and a 1 m receiver.

The drone mows the target field in East-West passes, South -> North, so the LAST
passes run right along the organic boundary. That is exactly where the meter bites.

Error model (open farmland, no urban canyon): correlated Gauss-Markov drift, not
white noise, plus rare multipath spikes on the 5 m receiver and short
convergence-loss windows on the 1 m receiver. Stdlib only, seeded, reproducible.

Writes into agrospray/data/:
  drone_truth.geojson   the true flown path
  drone_5m.geojson      a standard receiver (~5 m RMS)
  drone_1m.geojson      a corrected receiver (~1 m RMS, Galileo HAS class)

    python generate_field_track.py
"""

import json, math, os, random

random.seed(42)

M_PER_DEG_LAT = 111320.0
def m_per_deg_lon(lat): return M_PER_DEG_LAT * math.cos(math.radians(lat))

# --- field geometry (must match data/field.geojson) ---
LON_W, LON_E = 8.5980000, 8.6007867          # ~200 m East-West
LAT_S, LAT_N = 49.8690000, 49.8703475        # ~150 m North-South; LAT_N = organic boundary

SWATH_M   = 12.0     # boom width -> pass spacing
SPEED_MS  = 6.0      # spray speed
DT        = 1.0
TAU       = 30.0     # error correlation time (s)

# open-sky horizontal RMS (m): one environment, this is a field
SIGMA = {"5m": 3.0, "1m": 0.8}


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


def gm_series(n, sigma, tau, dt):
    a = math.exp(-dt / tau)
    e = [random.gauss(0, sigma)]
    b = sigma * math.sqrt(1 - a * a)
    for _ in range(1, n):
        e.append(a * e[-1] + b * random.gauss(0, 1))
    return e


def make_noisy(truth, receiver):
    n = len(truth)
    s_axis = SIGMA[receiver] / math.sqrt(2)
    ex, ey = gm_series(n, s_axis, TAU, DT), gm_series(n, s_axis, TAU, DT)
    bx = by = [0.0] * n
    if receiver == "5m":                       # rare multipath spikes
        bx, by = [0.0] * n, [0.0] * n
        k = 0
        while k < n:
            if random.random() < 1 / 90:
                mag, ang = random.uniform(6, 14), random.uniform(0, 2 * math.pi)
                dur = random.randint(5, 12)
                for j in range(dur):
                    if k + j >= n: break
                    d = 1 - j / dur
                    bx[k + j] += mag * d * math.cos(ang); by[k + j] += mag * d * math.sin(ang)
                k += dur
            else:
                k += 1
    out = []
    for i, (lon, lat, hdg) in enumerate(truth):
        out.append((lon + (ex[i] + bx[i]) / m_per_deg_lon(lat),
                    lat + (ey[i] + by[i]) / M_PER_DEG_LAT, hdg))
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
    json.dump(to_geojson(truth, "truth"), open(os.path.join(out, "drone_truth.geojson"), "w"))
    for r in ("5m", "1m"):
        noisy = make_noisy(truth, r)
        json.dump(to_geojson(noisy, f"gnss_{r}"), open(os.path.join(out, f"drone_{r}.geojson"), "w"))
        errs = [math.hypot((noisy[i][0] - truth[i][0]) * m_per_deg_lon(truth[i][1]),
                           (noisy[i][1] - truth[i][1]) * M_PER_DEG_LAT) for i in range(len(truth))]
        rms = math.sqrt(sum(e * e for e in errs) / len(errs))
        print(f"drone_{r}: {len(noisy)} fixes, RMS {rms:.2f} m, max {max(errs):.2f} m")
    print(f"wrote {len(truth)} fixes to agrospray/data/ (truth, 5m, 1m)")


if __name__ == "__main__":
    main()
