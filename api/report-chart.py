# api/report-chart.py — the chart data behind the Best Places reports
#
# Given a birth moment (jd) and birthplace (lat, lng), this works out
# everything the report engine needs, using Swiss Ephemeris, exactly as the
# reports engine did when Sarah approved the lists (Nov 1):
#   - natal planet positions (longitude, speed, right ascension, declination)
#   - natal Placidus cusps, Ascendant and MC
#   - parans: latitudes where two planets sit on angles at the same moment
#   - for every city in cities_world.json (same folder): relocated Placidus
#     cusps, Ascendant and MC, and the distance in km to each planet's four
#     lines (MC, IC, ASC, DSC)
#
# The city data is sent in a compact form (lists, not named fields) so the
# response stays well under Vercel's size limit. City i in the response is
# city i in cities_world.json; api/generate-report.js joins them back up.
#
# Called by api/generate-report.js (server to server). Not used by any page.
#   GET /api/report-chart?jd=2449694.3972&lat=51.5074&lng=-0.1278

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json, math, os, traceback

import swisseph as swe
import numpy as np

API_DIR = os.path.dirname(os.path.abspath(__file__))
swe.set_ephe_path(API_DIR)          # Chiron reads seas_18.se1 from this folder

VERSION = 'report-chart 1 (engine of Nov 1, 2026)'
BODIES = [('Sun', swe.SUN), ('Moon', swe.MOON), ('Mercury', swe.MERCURY), ('Venus', swe.VENUS),
          ('Mars', swe.MARS), ('Jupiter', swe.JUPITER), ('Saturn', swe.SATURN), ('Uranus', swe.URANUS),
          ('Neptune', swe.NEPTUNE), ('Pluto', swe.PLUTO), ('Chiron', swe.CHIRON), ('NNode', swe.TRUE_NODE)]
ANGLES = ['MC', 'IC', 'ASC', 'DSC']

_cities = None
def cities():
    global _cities
    if _cities is None:
        with open(os.path.join(API_DIR, 'cities_world.json'), encoding='utf-8') as f:
            _cities = json.load(f)
    return _cities

def n180(x): return ((x + 540) % 360) - 180

def flag_for(pid):
    # Chiron needs the seas_18.se1 file (Swiss Ephemeris); the rest use the
    # built-in Moshier ephemeris, the same as api/astro.py.
    return (2 if pid == swe.CHIRON else 4) | 256

def natal(jd, blat, blng):
    planets = {}
    for n, pid in BODIES:
        e, _ = swe.calc_ut(jd, pid, flag_for(pid))
        q, _ = swe.calc_ut(jd, pid, flag_for(pid) | 2048)
        planets[n] = {'lon': e[0], 'speed': e[3], 'ra': q[0], 'dec': q[1]}
    c, a = swe.houses(jd, blat, blng, b'P')
    return planets, {'cusps': list(c)[-12:], 'asc': a[0], 'mc': a[1]}

# ── Parans (same method as reports-engine/parans.py) ─────────────────
def _lst(ra, dec, ang, lat):
    if ang == 'MC': return ra % 360
    if ang == 'IC': return (ra + 180) % 360
    ch = -math.tan(math.radians(lat)) * math.tan(math.radians(dec))
    if abs(ch) > 1: return None
    H = math.degrees(math.acos(ch))
    return (ra - H) % 360 if ang == 'ASC' else (ra + H) % 360

def _wrap(x): return ((x + 180) % 360) - 180

def parans(planets):
    eq = {n: (planets[n]['ra'], planets[n]['dec']) for n, _ in BODIES}
    out = []
    names = [b[0] for b in BODIES]
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            p, q = names[i], names[j]
            for a in ANGLES:
                for b in ANGLES:
                    if a in ('MC', 'IC') and b in ('MC', 'IC'): continue
                    prev = None; prevlat = None
                    lat = -70.0
                    while lat <= 70.0001:
                        x = _lst(*eq[p], a, lat); y = _lst(*eq[q], b, lat)
                        d = _wrap(x - y) if x is not None and y is not None else None
                        if d is not None and prev is not None and abs(d) < 30 and abs(prev) < 30 and (d == 0 or (d > 0) != (prev > 0)):
                            t = prev / (prev - d) if prev != d else 0
                            out.append({'p1': p, 'a1': a, 'p2': q, 'a2': b, 'lat': round(prevlat + t * 0.1, 2)})
                        prev, prevlat = d, lat
                        lat = round(lat + 0.1, 4)
    return out

# ── Cities (same method as reports-engine/buildcities.py) ────────────
def city_data(jd, planets):
    C = cities()
    G = (280.46061837 + 360.98564736629 * (jd - 2451545)) % 360
    lat = np.radians([x['lat'] for x in C]); lng = np.radians([x['lng'] for x in C])

    def dist_to(points):
        if not points: return np.full(len(C), 99999)
        p = np.radians(np.array(points))
        plat, plon = p[:, 0][None, :], p[:, 1][None, :]
        dla = plat - lat[:, None]; dlo = plon - lng[:, None]
        h = np.sin(dla / 2) ** 2 + np.cos(lat[:, None]) * np.cos(plat) * np.sin(dlo / 2) ** 2
        return np.round(2 * 6371 * np.arcsin(np.sqrt(np.minimum(1, h))).min(axis=1)).astype(int)

    cols = []   # one column per planet x angle, in BODIES x ANGLES order
    for n, _ in BODIES:
        ra, dec = planets[n]['ra'], planets[n]['dec']; mc = n180(ra - G)
        L = {'MC': [(la / 10, mc) for la in range(-750, 751, 5)],
             'IC': [(la / 10, n180(mc + 180)) for la in range(-750, 751, 5)], 'ASC': [], 'DSC': []}
        for la10 in range(-750, 751, 5):
            la = la10 / 10; ch = -math.tan(math.radians(la)) * math.tan(math.radians(dec))
            if abs(ch) > 1: continue
            H = math.degrees(math.acos(ch))
            L['ASC'].append((la, n180(ra - H - G))); L['DSC'].append((la, n180(ra + H - G)))
        for k in ANGLES: cols.append(dist_to(L[k]))
    dist = np.stack(cols, axis=1).tolist()   # [city][planet*4 + angle]

    cusps, asc, mcs = [], [], []
    for ct in C:
        try:
            c2, a2 = swe.houses(jd, ct['lat'], ct['lng'], b'P')
            cusps.append(list(c2)[-12:]); asc.append(a2[0]); mcs.append(a2[1])
        except Exception:
            cusps.append(None); asc.append(None); mcs.append(None)   # polar: no Placidus houses
    return {'count': len(C), 'first': C[0]['n'], 'last': C[-1]['n'],
            'cusps': cusps, 'asc': asc, 'mc': mcs, 'dist': dist}

def build(jd, blat, blng):
    planets, nat = natal(jd, blat, blng)
    return {'version': VERSION, 'jd': jd,
            'gmst': (280.46061837 + 360.98564736629 * (jd - 2451545)) % 360,
            'planets': planets, 'natal': nat, 'parans': parans(planets),
            'bodies': [b[0] for b in BODIES], 'angles': ANGLES,
            'cities': city_data(jd, planets)}

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = parse_qs(urlparse(self.path).query)
        try:
            jd = float(params['jd'][0]); blat = float(params['lat'][0]); blng = float(params['lng'][0])
        except Exception:
            return self._send(400, {'error': 'jd, lat and lng are required'})
        if abs(blat) > 66:
            return self._send(400, {'error': 'Placidus houses are undefined for a birthplace beyond 66° latitude'})
        try:
            return self._send(200, build(jd, blat, blng))
        except Exception as ex:
            return self._send(500, {'error': str(ex), 'tb': traceback.format_exc()})

    def _send(self, code, obj):
        body = json.dumps(obj, separators=(',', ':')).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args): pass
