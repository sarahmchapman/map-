# api/daily.py — the daily engine behind the app's daily horoscope
#
# Given a person's birth moment (jd, Universal Time) and where they are right
# now (lat, lng), this works out what is influencing them today, the way the
# plan agreed with Sarah on Nov 11, 2026 (app/daily-horoscope-plan.md):
#
#   - Personal transits: aspects from today's planets (Moon included) to the
#     birth planets. Five major aspects. Orbs: 1° for the Moon, 2° for the Sun,
#     Mercury, Venus and Mars, 3° for Jupiter to Pluto.
#   - Where each one lands: the house of the RELOCATED chart (birth moment,
#     current place) that today's planet is passing through, and the house the
#     birth planet sits in there. The same aspect lands differently in LA and
#     Paris.
#   - "Only happens here": today's planets crossing the relocated Ascendant,
#     Descendant, MC or IC. These depend on where you stand.
#   - The influences are ranked, and the top three are what a day's reading
#     is written from. The writing itself is a separate step.
#
# Nothing on the website calls this yet. It is the first piece of the app.
#   GET /api/daily?jd=2449694.397222&lat=40.71&lng=-74.01
#   optional &at=<jd, UT> for a moment other than now (e.g. 8am local tomorrow)

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json, time, traceback

import swisseph as swe

VERSION = 'daily 1 (plan of Nov 11, 2026)'
FLAGS = 4 | 256                       # Moshier ephemeris + speeds, as api/astro.py

PLANETS = [('Sun', swe.SUN), ('Moon', swe.MOON), ('Mercury', swe.MERCURY), ('Venus', swe.VENUS),
           ('Mars', swe.MARS), ('Jupiter', swe.JUPITER), ('Saturn', swe.SATURN),
           ('Uranus', swe.URANUS), ('Neptune', swe.NEPTUNE), ('Pluto', swe.PLUTO)]

ASPECTS = [(0, 'conjunct'), (60, 'sextile'), (90, 'square'), (120, 'trine'), (180, 'opposite')]

# Orb for today's (transiting) planet.
ORB = {'Moon': 1.0, 'Sun': 2.0, 'Mercury': 2.0, 'Venus': 2.0, 'Mars': 2.0,
       'Jupiter': 3.0, 'Saturn': 3.0, 'Uranus': 3.0, 'Neptune': 3.0, 'Pluto': 3.0}

# How much each kind of influence counts when ranking the day.
W_TRANSIT = {'Moon': 1.0, 'Sun': 1.0, 'Mercury': 0.9, 'Venus': 1.0, 'Mars': 1.1,
             'Jupiter': 1.2, 'Saturn': 1.3, 'Uranus': 1.2, 'Neptune': 1.1, 'Pluto': 1.2}
W_NATAL = {'Sun': 1.2, 'Moon': 1.2, 'Mercury': 1.0, 'Venus': 1.0, 'Mars': 1.0,
           'Jupiter': 0.8, 'Saturn': 0.8, 'Uranus': 0.6, 'Neptune': 0.6, 'Pluto': 0.6,
           'Ascendant': 1.3, 'Descendant': 1.2, 'MC': 1.3, 'IC': 1.2}
W_ASPECT = {'conjunct': 1.0, 'opposite': 0.9, 'square': 0.9, 'trine': 0.8, 'sextile': 0.6}
ONLY_HERE_BONUS = 1.5                 # angle crossings are the thing only elsewhere does

EASY_PLANETS = {'Venus', 'Jupiter'}
HARD_PLANETS = {'Mars', 'Saturn', 'Pluto'}


def n180(x):
    return ((x + 540.0) % 360.0) - 180.0


def positions(jd):
    out = {}
    for name, pid in PLANETS:
        e, _ = swe.calc_ut(jd, pid, FLAGS)
        out[name] = {'lon': e[0] % 360.0, 'speed': e[3]}
    return out


def house_of(lon, cusps):
    for i in range(12):
        a, b = cusps[i], cusps[(i + 1) % 12]
        if (lon - a) % 360.0 < (b - a) % 360.0:
            return i + 1
    return 1


def lasts_label(orb, speed):
    # Roughly how long today's planet stays within orb of this point.
    days = (2.0 * orb) / max(abs(speed), 0.01)
    if days < 2.5: return 'today'
    if days < 10: return 'this week'
    if days < 45: return 'this month'
    return 'this season'


def tone(transit, aspect):
    if aspect in ('trine', 'sextile'): return 'easy'
    if aspect in ('square', 'opposite'): return 'tense'
    if transit in EASY_PLANETS: return 'easy'
    if transit in HARD_PLANETS: return 'tense'
    return 'strong'


def daily(natal_jd, lat, lng, at_jd):
    natal = positions(natal_jd)
    today = positions(at_jd)

    # Relocated chart: birth moment, current place (Placidus).
    c, a = swe.houses(natal_jd, lat, lng, b'P')
    cusps = list(c)[-12:]
    angles = {'Ascendant': a[0] % 360.0, 'MC': a[1] % 360.0,
              'Descendant': (a[0] + 180.0) % 360.0, 'IC': (a[1] + 180.0) % 360.0}

    found = []
    for t, tp in today.items():
        orb_max = ORB[t]
        # Aspects to birth planets (the same wherever you are).
        for n, np_ in natal.items():
            sep = n180(tp['lon'] - np_['lon'])
            for ang, name in ASPECTS:
                off = abs(abs(sep) - ang)
                if off > orb_max:
                    continue
                # Applying if the gap to exact is closing (birth planets don't move).
                step = 0.01
                later = abs(abs(n180(tp['lon'] + tp['speed'] * step - np_['lon'])) - ang)
                found.append({
                    'transit': t, 'natal': n, 'aspect': name, 'orb': round(off, 2),
                    'applying': later < off, 'retrograde': tp['speed'] < 0,
                    'lasts': lasts_label(orb_max, tp['speed']),
                    'tone': tone(t, name),
                    'transit_house': house_of(tp['lon'], cusps),
                    'natal_house': house_of(np_['lon'], cusps),
                    'only_here': False,
                    'score': W_TRANSIT[t] * W_NATAL[n] * W_ASPECT[name] * (1.0 - off / orb_max * 0.7),
                })
        # Crossing a relocated angle (only true where you are).
        for an, av in angles.items():
            off = abs(n180(tp['lon'] - av))
            if off > orb_max:
                continue
            later = abs(n180(tp['lon'] + tp['speed'] * 0.01 - av))
            found.append({
                'transit': t, 'natal': an, 'aspect': 'conjunct', 'orb': round(off, 2),
                'applying': later < off, 'retrograde': tp['speed'] < 0,
                'lasts': lasts_label(orb_max, tp['speed']),
                'tone': tone(t, 'conjunct'),
                'transit_house': house_of(tp['lon'], cusps),
                'natal_house': None,
                'only_here': True,
                'score': W_TRANSIT[t] * W_NATAL[an] * ONLY_HERE_BONUS * (1.0 - off / orb_max * 0.7),
            })

    found.sort(key=lambda x: -x['score'])
    for f in found:
        f['score'] = round(f['score'], 3)

    return {
        'version': VERSION,
        'at': at_jd,
        'location': {'lat': lat, 'lng': lng},
        'relocated': {'ascendant': round(angles['Ascendant'], 2), 'mc': round(angles['MC'], 2),
                      'cusps': [round(x, 2) for x in cusps]},
        'retrograde_today': [n for n, p in today.items() if p['speed'] < 0],
        'moon': {'lon': round(today['Moon']['lon'], 2), 'house': house_of(today['Moon']['lon'], cusps)},
        'top': found[:3],
        'influences': found,
    }


def now_jd():
    return time.time() / 86400.0 + 2440587.5


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            q = parse_qs(urlparse(self.path).query)
            jd = float(q['jd'][0]); lat = float(q['lat'][0]); lng = float(q['lng'][0])
            at = float(q['at'][0]) if 'at' in q else now_jd()
            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                raise ValueError('lat/lng out of range')
            body, code = daily(jd, lat, lng, at), 200
        except (KeyError, ValueError) as e:
            body, code = {'error': 'jd, lat and lng are required numbers (' + str(e) + ')'}, 400
        except Exception as e:
            body, code = {'error': str(e), 'trace': traceback.format_exc()}, 500
        out = json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(out)
