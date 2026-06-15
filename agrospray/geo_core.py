#!/usr/bin/env python3
"""
geo_core.py — vertical-neutral geometry plumbing for the "Down to the Meter" challenge.

Whatever vertical you pick (drones, rail, micromobility, sailing, your own find), the
core question is the same: given a position fix that is only accurate to a few meters,
which side of a boundary are you on, and does the answer change at 1 m vs 5 m?

This is the plumbing so you can skip to your decision logic:
  - load a track (a sequence of fixes) and your geodata (zones as polygons, or
    tracks / lanes / a start line as polylines)
  - point in polygon, distance to a zone edge
  - distance to a line, and which of several lines is nearest (the "which track /
    which lane" question)
  - an uncertainty test: could this fix, given its error radius, be over a boundary?

Model the fix as a point PLUS an error radius (about 10 m for a standard receiver,
about 2 m for a corrected one). That radius is the whole game: carry it into your logic.

Zero dependencies, Python standard library only. Run it for a worked example:
    python3 geo_core.py
"""

import json
import math

M_PER_DEG_LAT = 111320.0


def m_per_deg_lon(lat):
    return M_PER_DEG_LAT * math.cos(math.radians(lat))


# ---- loading ----

def load_track(path):
    """A track GeoJSON (first LineString feature) -> list of (lon, lat). Any altitude
    is dropped; use it yourself if you want it."""
    fc = json.load(open(path))
    coords = fc["features"][0]["geometry"]["coordinates"]
    return [(c[0], c[1]) for c in coords]


def load_polygons(path):
    """GeoJSON Polygons -> list of {'name', 'ring': [(lon,lat),...]}.
    Use for zones (no-fly areas, parking zones, anything area-shaped)."""
    fc = json.load(open(path))
    out = []
    for f in fc["features"]:
        g = f.get("geometry", {})
        if g.get("type") != "Polygon":
            continue
        ring = [(p[0], p[1]) for p in g["coordinates"][0]]
        out.append({"name": f.get("properties", {}).get("name", "?"), "ring": ring})
    return out


def load_lines(path):
    """GeoJSON LineStrings -> list of {'name', 'coords': [(lon,lat),...]}.
    Use for rail tracks, lane centerlines, a sailing start line, etc."""
    fc = json.load(open(path))
    out = []
    for f in fc["features"]:
        g = f.get("geometry", {})
        if g.get("type") != "LineString":
            continue
        coords = [(p[0], p[1]) for p in g["coordinates"]]
        out.append({"name": f.get("properties", {}).get("name", "?"), "coords": coords})
    return out


# ---- geometry (local equirectangular metres) ----

def _seg_dist_m(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    denom = dx * dx + dy * dy
    t = 0.0 if denom == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denom))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def point_in_polygon(lon, lat, ring):
    """Ray casting. The edge index wraps with % n, so this is correct whether or not
    the ring repeats its first vertex at the end."""
    n = len(ring)
    c = False
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        if (y1 > lat) != (y2 > lat):
            xint = x1 + (lat - y1) * (x2 - x1) / (y2 - y1)
            if xint > lon:
                c = not c
    return c


def dist_to_polygon_edge(lon, lat, ring):
    """Metres to the nearest edge of the polygon. 0.0 if inside."""
    if point_in_polygon(lon, lat, ring):
        return 0.0
    mlon = m_per_deg_lon(lat)
    px, py = lon * mlon, lat * M_PER_DEG_LAT
    n = len(ring)
    best = float("inf")
    for i in range(n):
        ax, ay = ring[i][0] * mlon, ring[i][1] * M_PER_DEG_LAT
        bx, by = ring[(i + 1) % n][0] * mlon, ring[(i + 1) % n][1] * M_PER_DEG_LAT
        best = min(best, _seg_dist_m(px, py, ax, ay, bx, by))
    return best


def dist_to_line(lon, lat, coords):
    """Metres to the nearest point on a polyline."""
    mlon = m_per_deg_lon(lat)
    px, py = lon * mlon, lat * M_PER_DEG_LAT
    best = float("inf")
    for i in range(len(coords) - 1):
        ax, ay = coords[i][0] * mlon, coords[i][1] * M_PER_DEG_LAT
        bx, by = coords[i + 1][0] * mlon, coords[i + 1][1] * M_PER_DEG_LAT
        best = min(best, _seg_dist_m(px, py, ax, ay, bx, by))
    return best


def nearest_line(lon, lat, lines):
    """Return (line, distance_m) for the nearest line. This is the 'which track /
    which lane' question: if the gap between lines is smaller than your error radius,
    you cannot tell them apart."""
    best = None
    for ln in lines:
        d = dist_to_line(lon, lat, ln["coords"])
        if best is None or d < best[1]:
            best = (ln, d)
    return best


def could_be_inside(lon, lat, ring, radius_m):
    """True if the fix, given its error radius, could be inside the zone: already
    inside, or within radius_m of an edge. This is the honest conformance test:
    a position is not a point, it is a point with uncertainty."""
    return point_in_polygon(lon, lat, ring) or dist_to_polygon_edge(lon, lat, ring) < radius_m


# ---- worked example: run me (needs no external data) ----

if __name__ == "__main__":
    # A vertical-neutral toy: two parallel lines 4 m apart (think rail tracks, or a
    # bike lane beside a car lane), and a fix sitting on one of them. Can a receiver
    # tell which line you are on?
    lat0 = 50.11
    dlat_4m = 4.0 / M_PER_DEG_LAT  # 4 m north-south, in degrees
    line_a = {"name": "track A", "coords": [(8.68, lat0), (8.69, lat0)]}
    line_b = {"name": "track B", "coords": [(8.68, lat0 + dlat_4m), (8.69, lat0 + dlat_4m)]}
    lines = [line_a, line_b]

    fix = (8.685, lat0)  # truly on track A
    ln, d = nearest_line(*fix, lines)
    print(f"Fix is truly on track A. Nearest line: {ln['name']} ({d:.2f} m).\n")

    print("Can the receiver tell which track?  (the two tracks are 4 m apart)")
    for label, radius in [("5 m receiver", 10.0), ("1 m receiver", 2.0)]:
        in_range = [l["name"] for l in lines if dist_to_line(*fix, l["coords"]) < radius]
        verdict = "AMBIGUOUS" if len(in_range) > 1 else "resolved"
        print(f"  {label} (uncertainty radius {radius:.0f} m): "
              f"{len(in_range)} track(s) in range -> {verdict}")

    print("\nThat is the whole flip: at 5 m both tracks are in range so you can't tell")
    print("which, at 1 m only the real one is. The same idea works for zones")
    print("(point_in_polygon + could_be_inside). Now build your decision logic.")
