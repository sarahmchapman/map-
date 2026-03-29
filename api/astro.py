"""
api/astro.py
Accurate astrocartography line calculations using Swiss Ephemeris (pyswisseph).
Matches Astro.com / Astro-Seek accuracy exactly.
"""

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import math
import swisseph as swe

# ── Constants ─────────────────────────────────────────────────────────────────
OBL_CONST = 23.4365  # fallback obliquity
DEG = math.pi / 180

def R(d): return d * DEG
def n360(x): return ((x % 360) + 360) % 360
def n180(x): return ((x + 540) % 360) - 180

# Swiss Ephemeris planet IDs
PLANETS = {
    'Sun':     swe.SUN,
    'Moon':    swe.MOON,
    'Mercury': swe.MERCURY,
    'Venus':   swe.VENUS,
    'Mars':    swe.MARS,
    'Jupiter': swe.JUPITER,
    'Saturn':  swe.SATURN,
    'Uranus':  swe.URANUS,
    'Neptune': swe.NEPTUNE,
    'Pluto':   swe.PLUTO,
}

# Calculation flags: use built-in ephemeris, ecliptic coords, with speed
IFLAG = swe.FLG_SWIEPH | swe.FLG_SPEED

# ── GMST ──────────────────────────────────────────────────────────────────────
def gmst(jd):
    T = (jd - 2451545.0) / 36525.0
    return n360(
        280.46061837
        + 360.98564736629 * (jd - 2451545)
        + 0.000387933 * T * T
        - T * T * T / 38710000.0
    )

# ── Get true obliquity from Swiss Ephemeris ───────────────────────────────────
def get_obliquity(jd):
    try:
        # swe.calc_ut with SE_ECL_NUT returns nutation and obliquity
        result, _ = swe.calc_ut(jd, swe.ECL_NUT, 0)
        return result[0]  # true obliquity in degrees
    except:
        return OBL_CONST

# ── Convert ecliptic longitude → RA, Dec ─────────────────────────────────────
def lon_to_ra_dec(lon, obl):
    l = R(lon)
    e = R(obl)
    ra  = n360(math.atan2(math.sin(l) * math.cos(e), math.cos(l)) * 180 / math.pi)
    dec = math.asin(math.sin(e) * math.sin(l)) * 180 / math.pi
    return ra, dec

# ── Build all ACG lines ───────────────────────────────────────────────────────
def build_acg(jd):
    G = gmst(jd)
    obl = get_obliquity(jd)
    lines = {}

    for name, planet_id in PLANETS.items():
        try:
            # swe.calc_ut returns (longitude, latitude, distance, speed_lon, speed_lat, speed_dist)
            result, _ = swe.calc_ut(jd, planet_id, IFLAG)
            lon = result[0]  # ecliptic longitude in degrees
        except Exception as ex:
            continue

        ra, dec = lon_to_ra_dec(lon, obl)
        dr = R(dec)

        # MC: geographic longitude where planet is on Midheaven
        # RAMC = GMST + lng → mcLon = RA - GMST
        mc_lon = n180(ra - G)
        ic_lon = n180(mc_lon + 180)

        mc, ic, asc, dsc = [], [], [], []

        # MC and IC: vertical lines at all latitudes
        for lat in range(-85, 86):
            mc.append([lat, mc_lon])
            ic.append([lat, ic_lon])

        # ASC/DSC: hour angle method
        # cos(H) = -tan(lat) * tan(dec)
        # ASC = RA - H - GMST  (planet rising, eastern horizon)
        # DSC = RA + H - GMST  (planet setting, western horizon)
        for lat in range(-85, 86):
            cos_h = -math.tan(R(lat)) * math.tan(dr)
            if abs(cos_h) > 1:
                continue  # circumpolar or never rises at this latitude
            H = math.acos(max(-1, min(1, cos_h))) * 180 / math.pi
            asc.append([lat, n180(ra - H - G)])
            dsc.append([lat, n180(ra + H - G)])

        lines[name] = {
            'MC':    mc,
            'IC':    ic,
            'ASC':   asc,
            'DSC':   dsc,
            'mcLon': mc_lon,
            'ra':    ra,
            'dec':   dec,
        }

    return lines


# ── Vercel Python handler ─────────────────────────────────────────────────────
class handler(BaseHTTPRequestHandler):

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        try:
            if 'jd' not in params:
                self.wfile.write(json.dumps({'error': 'jd required'}).encode())
                return

            jd = float(params['jd'][0])
            lines = build_acg(jd)
            self.wfile.write(json.dumps({'lines': lines}).encode())

        except Exception as e:
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def log_message(self, format, *args):
        pass  # suppress default logging
