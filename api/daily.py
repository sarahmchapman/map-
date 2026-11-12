# api/daily.py — the daily engine behind the app's daily horoscope
#
# Given a person's birth moment (jd, Universal Time) and where they are
# (lat, lng), this works out what is influencing them, as agreed with Sarah
# (app/daily-horoscope-plan.md, Nov 11, 2026):
#
#   - TODAY: the Moon's aspects to the birth planets and to the relocated
#     angles that become exact during the day (from the reading's moment, 8am
#     local, to the same time tomorrow), each with the local time it is exact.
#   - THIS WEEK / MONTH / SEASON: today's Sun to Pluto aspecting the birth
#     planets, or crossing the relocated angles, within orb now (2° for the Sun
#     to Mars, 3° for Jupiter to Pluto). Each comes with real dates: when it
#     starts, when it is exact (more than once if the planet turns retrograde)
#     and when it ends. How long it lasts decides its label.
#   - Five major aspects. Crossing a relocated angle is "only here".
#   - Where each one lands: the house of the RELOCATED chart (birth moment,
#     current place) that today's planet is in.
#   - Order: today first, then this week, this month, this season. At least
#     three today/this week when there are that many, then up to three longer.
#
#   GET /api/daily?jd=2449694.397222&lat=51.51&lng=-0.13
#   optional: &at=<jd UT> (default now)  &tz=<hours from UT, for times/dates>

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json, time, traceback

import swisseph as swe

VERSION = 'daily 2 (today first, with dates; Nov 11, 2026)'
FLAGS = 4 | 256                       # Moshier ephemeris + speeds, as api/astro.py

PLANETS = [('Sun', swe.SUN), ('Moon', swe.MOON), ('Mercury', swe.MERCURY), ('Venus', swe.VENUS),
           ('Mars', swe.MARS), ('Jupiter', swe.JUPITER), ('Saturn', swe.SATURN),
           ('Uranus', swe.URANUS), ('Neptune', swe.NEPTUNE), ('Pluto', swe.PLUTO)]
PID = dict(PLANETS)

# Signed angle from target to planet -> aspect name.
ASPECT_AT = {0: 'conjunct', 60: 'sextile', 300: 'sextile', 90: 'square', 270: 'square',
             120: 'trine', 240: 'trine', 180: 'opposite'}
ASPECTS = [(0, 'conjunct'), (60, 'sextile'), (90, 'square'), (120, 'trine'), (180, 'opposite')]

ORB = {'Sun': 2.0, 'Mercury': 2.0, 'Venus': 2.0, 'Mars': 2.0,
       'Jupiter': 3.0, 'Saturn': 3.0, 'Uranus': 3.0, 'Neptune': 3.0, 'Pluto': 3.0}

W_TRANSIT = {'Moon': 1.0, 'Sun': 1.0, 'Mercury': 0.9, 'Venus': 1.0, 'Mars': 1.1,
             'Jupiter': 1.2, 'Saturn': 1.3, 'Uranus': 1.2, 'Neptune': 1.1, 'Pluto': 1.2}
W_NATAL = {'Sun': 1.2, 'Moon': 1.2, 'Mercury': 1.0, 'Venus': 1.0, 'Mars': 1.0,
           'Jupiter': 0.8, 'Saturn': 0.8, 'Uranus': 0.6, 'Neptune': 0.6, 'Pluto': 0.6,
           'Ascendant': 1.3, 'Descendant': 1.2, 'MC': 1.3, 'IC': 1.2}
W_ASPECT = {'conjunct': 1.0, 'opposite': 0.9, 'square': 0.9, 'trine': 0.8, 'sextile': 0.6}
ONLY_HERE_BONUS = 1.5

EASY_PLANETS = {'Venus', 'Jupiter'}
HARD_PLANETS = {'Mars', 'Saturn', 'Pluto'}
GROUPS = ['today', 'this week', 'this month', 'this season']
MIN_SHORT, MAX_TODAY, MAX_WEEK, MAX_LONG = 3, 3, 2, 3
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def n180(x):
    return ((x + 540.0) % 360.0) - 180.0


def lon(jd, name):
    e, _ = swe.calc_ut(jd, PID[name], FLAGS)
    return e[0] % 360.0, e[3]


def house_of(l, cusps):
    for i in range(12):
        a, b = cusps[i], cusps[(i + 1) % 12]
        if (l - a) % 360.0 < (b - a) % 360.0:
            return i + 1
    return 1


def tone(transit, aspect):
    if aspect in ('trine', 'sextile'): return 'easy'
    if aspect in ('square', 'opposite'): return 'tense'
    if transit in EASY_PLANETS: return 'easy'
    if transit in HARD_PLANETS: return 'tense'
    return 'strong'


def local(jd, tz):
    y, m, d, h = swe.revjul(jd + tz / 24.0)
    return int(y), int(m), int(d), h


def fmt_date(jd, tz):
    y, m, d, _ = local(jd, tz)
    return MONTHS[m - 1] + ' ' + str(d)


def fmt_time(jd, tz):
    _, _, _, h = local(jd, tz)
    hh, mm = int(h), int(round((h - int(h)) * 60))
    if mm == 60: hh, mm = hh + 1, 0
    hh %= 24
    return str((hh % 12) or 12) + ':' + str(mm).zfill(2) + (' am' if hh < 12 else ' pm')


def score(t, target, aspect, closeness, only_here):
    s = W_TRANSIT[t] * W_NATAL[target] * W_ASPECT[aspect] * (1.0 - 0.7 * min(1.0, closeness))
    return s * (ONLY_HERE_BONUS if only_here else 1.0)


# ── Today: the Moon's exact aspects during the day ────────────────────
def moon_today(at, targets, cusps, tz, hours=48):
    out = []
    steps = [at + h / 24.0 for h in range(0, hours + 1)]
    moon = [lon(t, 'Moon')[0] for t in steps]
    for tname, (tlon, only_here) in targets.items():
        for A, aname in ASPECT_AT.items():
            # Angles: every aspect to the Ascendant and MC except the opposition,
            # crossings only for the Descendant and IC (so nothing is counted twice).
            if only_here and (A == 180 or (tname in ('Descendant', 'IC') and A != 0)):
                continue
            f = [n180(m - tlon - A) for m in moon]
            for i in range(hours):
                a, b = f[i], f[i + 1]
                if a == 0 or (a < 0 < b):          # the Moon moves forward, so the gap rises through 0
                    lo, hi = steps[i], steps[i + 1]
                    for _ in range(20):
                        mid = (lo + hi) / 2
                        if n180(lon(mid, 'Moon')[0] - tlon - A) < 0: lo = mid
                        else: hi = mid
                    exact = (lo + hi) / 2
                    ml = lon(exact, 'Moon')[0]
                    same_day = local(exact, tz)[:3] == local(at, tz)[:3]
                    within_day = exact - at <= 1.0
                    out.append({
                        'transit': 'Moon', 'natal': tname, 'aspect': aname,
                        'when': 'today' if within_day else 'this week', 'exact': exact,
                        'timing': ('exact today at ' if same_day else 'exact overnight at ' if within_day else 'exact tomorrow at ') + fmt_time(exact, tz),
                        'dates': {'exact': [fmt_time(exact, tz)]},
                        'retrograde': False, 'tone': tone('Moon', aname),
                        'transit_house': house_of(ml, cusps),
                        'natal_house': None if only_here else house_of(tlon, cusps),
                        'only_here': only_here,
                        'score': score('Moon', tname, aname, abs(exact - (at + 0.25)) * 2, only_here),
                    })
    return out


# ── Longer: when an aspect starts, is exact and ends ──────────────────
def orb_at(jd, planet, tlon, ang):
    return abs(abs(n180(lon(jd, planet)[0] - tlon)) - ang)


def window(at, planet, tlon, ang, orb):
    step = 1.0 if planet in ('Sun', 'Mercury', 'Venus', 'Mars') else 2.0
    limit = 120 if step == 1.0 else 500
    start = at
    for _ in range(int(limit / step)):
        if orb_at(start - step, planet, tlon, ang) > orb: break
        start -= step
    end = at
    for _ in range(int(limit / step)):
        if orb_at(end + step, planet, tlon, ang) > orb: break
        end += step
    # Exact passes: low points of the orb inside the window.
    xs, t = [], start - step
    vals = []
    while t <= end + step:
        vals.append((t, orb_at(t, planet, tlon, ang))); t += step / 2.0
    for i in range(1, len(vals) - 1):
        if vals[i][1] <= vals[i - 1][1] and vals[i][1] <= vals[i + 1][1] and vals[i][1] < orb:
            lo, hi = vals[i - 1][0], vals[i + 1][0]      # refine the low point
            for _ in range(30):
                m1, m2 = lo + (hi - lo) / 3, hi - (hi - lo) / 3
                if orb_at(m1, planet, tlon, ang) < orb_at(m2, planet, tlon, ang): hi = m2
                else: lo = m1
            ex = (lo + hi) / 2
            if orb_at(ex, planet, tlon, ang) < 0.25 and not any(abs(ex - x) < 3 for x in xs):
                xs.append(ex)
    return start, end, xs


def lasting(at, targets, cusps, tz):
    out = []
    for p, orb in ORB.items():
        pl, sp = lon(at, p)
        for tname, (tlon, only_here) in targets.items():
            for ang, aname in ASPECTS:
                if only_here and ang != 0:
                    continue                      # angles: crossings only
                off = abs(abs(n180(pl - tlon)) - ang)
                if off > orb:
                    continue
                start, end, xs = window(at, p, tlon, ang, orb)
                days = end - start
                when = 'this week' if days <= 10 else 'this month' if days <= 45 else 'this season'
                exact_txt = [fmt_date(x, tz) for x in xs]
                if when == 'this week':
                    timing = ('exact ' + ' and '.join(exact_txt) + ', ' if exact_txt else '') + \
                             'in effect ' + fmt_date(start, tz) + ' to ' + fmt_date(end, tz)
                else:
                    timing = fmt_date(start, tz) + ' to ' + fmt_date(end, tz) + \
                             ('; exact ' + ' and '.join(exact_txt) if exact_txt else '')
                out.append({
                    'transit': p, 'natal': tname, 'aspect': aname, 'orb': round(off, 2),
                    'when': when, 'timing': timing,
                    'dates': {'from': fmt_date(start, tz), 'to': fmt_date(end, tz), 'exact': exact_txt},
                    'retrograde': sp < 0, 'tone': tone(p, aname),
                    'transit_house': house_of(pl, cusps),
                    'natal_house': None if only_here else house_of(tlon, cusps),
                    'only_here': only_here,
                    'score': score(p, tname, aname, off / orb, only_here),
                })
    return out


def daily(natal_jd, lat, lng, at_jd, tz=0.0):
    swe.set_ephe_path(None)
    natal = {n: lon(natal_jd, n)[0] for n, _ in PLANETS}
    c, a = swe.houses(natal_jd, lat, lng, b'P')
    cusps = list(c)[-12:]
    angles = {'Ascendant': a[0] % 360.0, 'MC': a[1] % 360.0,
              'Descendant': (a[0] + 180.0) % 360.0, 'IC': (a[1] + 180.0) % 360.0}
    targets = {n: (v, False) for n, v in natal.items()}
    targets.update({n: (v, True) for n, v in angles.items()})

    moon = moon_today(at_jd, targets, cusps, tz)
    today = sorted([x for x in moon if x['when'] == 'today'], key=lambda x: x['exact'])
    tomorrow = sorted([x for x in moon if x['when'] != 'today'], key=lambda x: x['exact'])
    longer = lasting(at_jd, targets, cusps, tz)
    week = sorted([x for x in longer if x['when'] == 'this week'], key=lambda x: -x['score'])
    # The strongest longer ones, then shown month before season.
    rest = sorted([x for x in longer if x['when'] != 'this week'], key=lambda x: -x['score'])[:MAX_LONG]
    rest.sort(key=lambda x: (GROUPS.index(x['when']), -x['score']))

    # Today first (the three strongest, in time order), then up to two for this
    # week, at least three in all; then up to three longer ones.
    best_today = sorted(today, key=lambda x: -x['score'])[:MAX_TODAY]
    best_today.sort(key=lambda x: x['exact'])
    short = best_today + week[:MAX_WEEK]
    if len(short) < MIN_SHORT:                      # a quiet day: add tomorrow's Moon
        short = (short + tomorrow)[:MIN_SHORT]
    chosen = short + rest

    for f in moon + longer:
        f['score'] = round(f['score'], 3)
        f.pop('exact', None)

    return {
        'version': VERSION,
        'at': at_jd, 'tz': tz,
        'location': {'lat': lat, 'lng': lng},
        'relocated': {'ascendant': round(angles['Ascendant'], 2), 'mc': round(angles['MC'], 2),
                      'cusps': [round(x, 2) for x in cusps]},
        'retrograde_today': [p for p in ORB if lon(at_jd, p)[1] < 0],
        'top': chosen,
        'influences': today + tomorrow + longer,
    }


def now_jd():
    return time.time() / 86400.0 + 2440587.5


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            q = parse_qs(urlparse(self.path).query)
            jd = float(q['jd'][0]); lat = float(q['lat'][0]); lng = float(q['lng'][0])
            at = float(q['at'][0]) if 'at' in q else now_jd()
            tz = float(q['tz'][0]) if 'tz' in q else 0.0
            if not (-90 <= lat <= 90 and -180 <= lng <= 180 and -14 <= tz <= 14):
                raise ValueError('lat/lng/tz out of range')
            body, code = daily(jd, lat, lng, at, tz), 200
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
