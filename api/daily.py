# api/daily.py — the daily engine behind the app's daily horoscope
#
# Given a person's birth moment (jd, Universal Time), where they are (lat,
# lng) and their time zone (an IANA name such as America/New_York), this
# works out what is influencing them for one of four tabs:
#
#   view=today     the local calendar day: every aspect that becomes exact
#                  today (the Moon's several, sometimes a faster planet's),
#                  each with its local time; plus the two strongest longer
#                  influences in effect, so the day always has context.
#   view=tomorrow  the same for tomorrow.
#   view=week      the next 7 days: aspects from the Sun to Pluto that are
#                  exact this week or in effect now, each with dates.
#   view=month     the next 30 days, including long-term transits, with dates.
#
# Rules agreed with Sarah (app/daily-horoscope-plan.md, Nov 11–14, 2026):
#   - Personal transits to the birth planets, five major aspects. Orbs: 1° for
#     the Moon, 2° for the Sun to Mars, 3° for Jupiter to Pluto.
#   - Placed in the RELOCATED chart (birth moment, current place). Crossing a
#     relocated angle (Ascendant, Descendant, MC, IC) is "only here".
#   - Longer influences carry real dates: when they start, when they are exact
#     (every pass, retrograde included) and when they end, with the year when
#     it is not this year. Over a year in orb: "long-term".
#   - Above the polar circles Placidus cannot be drawn; a fallback house
#     system is used there and named in the reply (FALLBACK below).
#
#   GET /api/daily?jd=2449694.397222&lat=40.71&lng=-74.01&zone=America/New_York&view=today
#   optional &date=YYYY-MM-DD (local day the reading is for; default today there)

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta, date as Date
from zoneinfo import ZoneInfo
import json, time

import swisseph as swe

VERSION = 'daily 3 (tabs: today, tomorrow, week, month; Nov 14, 2026)'
FLAGS = 4 | 256                       # Moshier ephemeris + speeds, as api/astro.py
FALLBACK = (b'O', 'Porphyry')         # houses above the polar circles (Sarah's call)

PLANETS = [('Sun', swe.SUN), ('Moon', swe.MOON), ('Mercury', swe.MERCURY), ('Venus', swe.VENUS),
           ('Mars', swe.MARS), ('Jupiter', swe.JUPITER), ('Saturn', swe.SATURN),
           ('Uranus', swe.URANUS), ('Neptune', swe.NEPTUNE), ('Pluto', swe.PLUTO)]
PID = dict(PLANETS)
SLOW = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']

# Signed angle from target to planet -> aspect name.
ASPECT_AT = {0: 'conjunct', 60: 'sextile', 300: 'sextile', 90: 'square', 270: 'square',
             120: 'trine', 240: 'trine', 180: 'opposite'}
ORB = {'Moon': 1.0, 'Sun': 2.0, 'Mercury': 2.0, 'Venus': 2.0, 'Mars': 2.0,
       'Jupiter': 3.0, 'Saturn': 3.0, 'Uranus': 3.0, 'Neptune': 3.0, 'Pluto': 3.0}
# How far to search for when an influence starts and ends: (step days, limit days).
SEARCH = {'Sun': (1, 150), 'Mercury': (1, 150), 'Venus': (1, 200), 'Mars': (1, 250),
          'Jupiter': (3, 900), 'Saturn': (3, 900), 'Uranus': (5, 1800), 'Neptune': (5, 1800), 'Pluto': (5, 1800)}

W_TRANSIT = {'Moon': 1.0, 'Sun': 1.0, 'Mercury': 0.9, 'Venus': 1.0, 'Mars': 1.1,
             'Jupiter': 1.2, 'Saturn': 1.3, 'Uranus': 1.2, 'Neptune': 1.1, 'Pluto': 1.2}
W_NATAL = {'Sun': 1.2, 'Moon': 1.2, 'Mercury': 1.0, 'Venus': 1.0, 'Mars': 1.0,
           'Jupiter': 0.8, 'Saturn': 0.8, 'Uranus': 0.6, 'Neptune': 0.6, 'Pluto': 0.6,
           'Ascendant': 1.3, 'Descendant': 1.2, 'MC': 1.3, 'IC': 1.2}
W_ASPECT = {'conjunct': 1.0, 'opposite': 0.9, 'square': 0.9, 'trine': 0.8, 'sextile': 0.6}
ONLY_HERE_BONUS = 1.5
EASY_PLANETS = {'Venus', 'Jupiter'}
HARD_PLANETS = {'Mars', 'Saturn', 'Pluto'}

# How many of each to show per tab.
CAP = {'today': (5, 2), 'tomorrow': (5, 2), 'week': (7,), 'month': (8,)}
MIN_ITEMS = 3

MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


class BadRequest(ValueError):
    pass


def n180(x):
    return ((x + 540.0) % 360.0) - 180.0


def pos(jd, name):
    e, _ = swe.calc_ut(jd, PID[name], FLAGS)
    return e[0] % 360.0, e[3]


# ── Time ────────────────────────────────────────────────────────────────
def jd_of(dt):
    return dt.timestamp() / 86400.0 + 2440587.5


def dt_of(jd, zone):
    return datetime.fromtimestamp((jd - 2440587.5) * 86400.0, tz=zone)


def local_midnight(d, zone):
    return jd_of(datetime(d.year, d.month, d.day, tzinfo=zone))


def fmt_time(jd, zone):
    t = dt_of(jd + 0.5 / 1440.0, zone)              # round to the minute
    h = t.hour % 12 or 12
    return '%d:%02d %s' % (h, t.minute, 'am' if t.hour < 12 else 'pm')


def fmt_date(jd, zone, ref_year):
    t = dt_of(jd, zone)
    s = MONTHS[t.month - 1] + ' ' + str(t.day)
    return s + (', ' + str(t.year) if t.year != ref_year else '')


# ── Chart ───────────────────────────────────────────────────────────────
def relocated(natal_jd, lat, lng):
    try:
        c, a = swe.houses(natal_jd, lat, lng, b'P')
        system = 'Placidus'
    except Exception:
        c, a = swe.houses(natal_jd, lat, lng, FALLBACK[0])
        system = FALLBACK[1]
    cusps = list(c)[-12:]
    angles = {'Ascendant': a[0] % 360.0, 'MC': a[1] % 360.0,
              'Descendant': (a[0] + 180.0) % 360.0, 'IC': (a[1] + 180.0) % 360.0}
    return cusps, angles, system


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


def aspects_for(planet, tname, only_here):
    # Angles: the Moon may aspect the Ascendant and MC (not the opposition,
    # which is a crossing of the Descendant/IC); everything else crosses only.
    for A, name in ASPECT_AT.items():
        if only_here and (A != 0 and (planet != 'Moon' or tname in ('Descendant', 'IC') or A == 180)):
            continue
        yield A, name


# ── Finding exact moments ──────────────────────────────────────────────
def crossings(planet, tlon, A, t0, t1, step):
    """Every moment between t0 and t1 when planet is exactly at tlon + A."""
    out = []
    t, g0 = t0, n180(pos(t0, planet)[0] - tlon - A)
    while t < t1:
        t2 = min(t + step, t1)
        g1 = n180(pos(t2, planet)[0] - tlon - A)
        if (g0 == 0 or g0 * g1 < 0) and abs(g0 - g1) < 90:
            lo, hi, glo = t, t2, g0
            for _ in range(40):
                mid = (lo + hi) / 2
                gm = n180(pos(mid, planet)[0] - tlon - A)
                if (gm < 0) == (glo < 0): lo, glo = mid, gm
                else: hi = mid
            out.append((lo + hi) / 2)
        t, g0 = t2, g1
    return out


def orb_at(jd, planet, tlon, ang):
    return abs(abs(n180(pos(jd, planet)[0] - tlon)) - ang)


def window(planet, tlon, A, at):
    """When this influence entered orb and leaves it, around `at`."""
    ang = A if A <= 180 else 360 - A
    step, limit = SEARCH[planet]
    orb = ORB[planet]
    start = at
    while at - start < limit and orb_at(start - step, planet, tlon, ang) <= orb:
        start -= step
    end = at
    while end - at < limit and orb_at(end + step, planet, tlon, ang) <= orb:
        end += step
    # refine the edges to the day
    for _ in range(12):
        if orb_at(start - step / 4, planet, tlon, ang) <= orb: start -= step / 4
        if orb_at(end + step / 4, planet, tlon, ang) <= orb: end += step / 4
    exacts = []
    for A2 in ([A] if A in (0, 180) else [A, 360 - A]):
        exacts += crossings(planet, tlon, A2, start - step, end + step, max(0.5, step / 2))
    exacts = sorted(x for x in exacts if start - step <= x <= end + step)
    # closest approach when it never becomes exact
    closest = None
    if not exacts:
        best = (orb + 1, at)
        t = start
        while t <= end:
            o = orb_at(t, planet, tlon, ang)
            if o < best[0]: best = (o, t)
            t += max(0.25, step / 4)
        closest = best
    return start, end, exacts, closest


def score(t, target, aspect, closeness, only_here):
    s = W_TRANSIT[t] * W_NATAL[target] * W_ASPECT[aspect] * (1.0 - 0.7 * min(1.0, max(0.0, closeness)))
    return s * (ONLY_HERE_BONUS if only_here else 1.0)


# ── The tabs ────────────────────────────────────────────────────────────
def item(planet, tname, A, aname, only_here, jd_for_house, cusps, natal):
    pl, sp = pos(jd_for_house, planet)
    return {
        'transit': planet, 'natal': tname, 'aspect': aname, 'only_here': only_here,
        'tone': tone(planet, aname), 'retrograde': sp < 0,
        'transit_house': None if only_here else house_of(pl, cusps),
        'natal_house': None if only_here else house_of(natal[tname][0], cusps),
    }


def exact_in(t0, t1, targets, cusps, natal, zone, label):
    """Every aspect that becomes exact between t0 and t1, with its local time."""
    found = []
    for planet in ['Moon'] + SLOW:
        step = 1 / 24.0 if planet == 'Moon' else 0.25
        for tname, (tlon, only_here) in targets.items():
            for A, aname in aspects_for(planet, tname, only_here):
                for x in crossings(planet, tlon, A, t0, t1, step):
                    it = item(planet, tname, A, aname, only_here, x, cusps, natal)
                    it.update({'when': label, 'timing': 'exact at ' + fmt_time(x, zone),
                               'dates': {'exact': [fmt_time(x, zone)]}, '_t': x,
                               'score': score(planet, tname, aname, abs(x - (t0 + 0.6)), only_here)})
                    if planet != 'Moon':
                        it['score'] *= 1.3          # a slower planet exact today is notable
                    found.append(it)
    return found


def in_effect(at, view_end, targets, cusps, natal, zone, ref_year, planets=SLOW):
    """Influences from the Sun to Pluto in orb now, or exact before view_end."""
    found, seen = [], set()
    for planet in planets:
        pl, sp = pos(at, planet)
        for tname, (tlon, only_here) in targets.items():
            for A, aname in aspects_for(planet, tname, only_here):
                ang = A if A <= 180 else 360 - A
                key = (planet, tname, ang)
                if key in seen:
                    continue
                now_in = abs(abs(n180(pl - tlon)) - ang) <= ORB[planet]
                coming = [] if now_in else crossings(planet, tlon, A, at, view_end, 0.5)
                if not now_in and not coming:
                    continue
                seen.add(key)
                ref = at if now_in else coming[0]
                start, end, exacts, closest = window(planet, tlon, A, ref)
                days = end - start
                when = 'long-term' if days > 365 else 'this season' if days > 45 else 'this month' if days > 10 else 'this week'
                d = lambda j: fmt_date(j, zone, ref_year)
                ex = [d(x) for x in exacts]
                nxt = [x for x in exacts if x >= at]
                # Building: getting closer to exact right now; easing: moving away
                # (between two retrograde passes it eases, then builds again).
                building = orb_at(at + 0.5, planet, tlon, ang) < orb_at(at, planet, tlon, ang)
                timing = ('Building' if building else 'Easing') + ' · in effect ' + d(start) + ' to ' + d(end)
                if ex:
                    timing += '; exact ' + ' and '.join(ex)
                elif closest:
                    timing += '; closest ' + d(closest[1])
                closeness = (abs(nxt[0] - at) / max(days, 1)) if nxt else 0.6
                it = item(planet, tname, A, aname, only_here, ref, cusps, natal)
                it.update({'when': when, 'span': when, 'timing': timing,
                           'dates': {'from': d(start), 'to': d(end), 'exact': ex,
                                     'closest': ({'date': d(closest[1]), 'orb': round(closest[0], 2)} if closest else None)},
                           'building': building, 'phase': 'building' if building else 'easing',
                           '_next': nxt[0] if nxt else None,
                           '_t': nxt[0] if nxt else start,
                           'score': score(planet, tname, aname, closeness, only_here)})
                found.append(it)
    return found


def daily(natal_jd, lat, lng, zone_name, view='today', day=None):
    try:
        zone = ZoneInfo(zone_name)
    except Exception:
        raise BadRequest('unknown time zone: ' + str(zone_name))
    if view not in CAP:
        raise BadRequest('view must be today, tomorrow, week or month')
    today = day or datetime.now(zone).date()
    natal = {n: pos(natal_jd, n) for n, _ in PLANETS}
    cusps, angles, system = relocated(natal_jd, lat, lng)
    targets = {n: (v[0], False) for n, v in natal.items()}
    targets.update({n: (v, True) for n, v in angles.items()})

    d0 = today + timedelta(days=1) if view == 'tomorrow' else today
    t0 = local_midnight(d0, zone)
    ref_year = d0.year

    if view in ('today', 'tomorrow'):
        t1 = local_midnight(d0 + timedelta(days=1), zone)
        exact = exact_in(t0, t1, targets, cusps, natal, zone, view)
        n_exact, n_more = CAP[view]
        exact = sorted(exact, key=lambda x: -x['score'])[:n_exact]
        exact.sort(key=lambda x: x['_t'])
        noon = (t0 + t1) / 2
        longer = in_effect(noon, noon, targets, cusps, natal, zone, ref_year)
        names = {(x['transit'], x['natal'], x['aspect']) for x in exact}
        longer = [x for x in longer if (x['transit'], x['natal'], x['aspect']) not in names]
        longer.sort(key=lambda x: -x['score'])
        extra = max(n_more, MIN_ITEMS - len(exact))
        for x in longer[:extra]:
            x['when'] = 'in effect'
            x.pop('_next', None)
        top = exact + longer[:extra]
    else:
        days = 7 if view == 'week' else 30
        t1 = t0 + days
        cands = in_effect(t0, t1, targets, cusps, natal, zone, ref_year)
        # Exact within this tab's days counts most; background influences less.
        for x in cands:
            x['exact_here'] = bool(x['_next'] is not None and x['_next'] <= t1)
            if not x['exact_here']:
                x['score'] *= 0.7
            x['when'] = view if view == 'week' else 'month'
        top = sorted(cands, key=lambda x: -x['score'])[:CAP[view][0]]
        # Exact this week/month first, in date order; then what is in the background.
        top.sort(key=lambda x: (0, x['_next']) if x['exact_here'] else (1, -x['score']))

    for x in top:
        x['score'] = round(x['score'], 3)
        x.pop('_t', None); x.pop('_next', None)
    return {
        'version': VERSION, 'view': view, 'date': d0.isoformat(), 'zone': zone_name,
        'location': {'lat': lat, 'lng': lng},
        'relocated': {'ascendant': round(angles['Ascendant'], 2), 'mc': round(angles['MC'], 2),
                      'house_system': system, 'cusps': [round(x, 2) for x in cusps]},
        'retrograde': [p for p in SLOW if pos(t0, p)[1] < 0],
        'top': top,
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            q = parse_qs(urlparse(self.path).query)
            try:
                jd = float(q['jd'][0]); lat = float(q['lat'][0]); lng = float(q['lng'][0])
                zone = q['zone'][0]
            except (KeyError, ValueError):
                raise BadRequest('jd, lat, lng and zone are required')
            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                raise BadRequest('lat/lng out of range')
            view = q.get('view', ['today'])[0]
            day = None
            if 'date' in q:
                try: day = Date.fromisoformat(q['date'][0])
                except ValueError: raise BadRequest('date must be YYYY-MM-DD')
            body, code = daily(jd, lat, lng, zone, view, day), 200
        except BadRequest as e:
            body, code = {'error': str(e)}, 400
        except Exception as e:
            print('daily failed:', repr(e))
            body, code = {'error': 'daily engine failed'}, 500
        out = json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', 'https://elsewhereastro.com')
        self.end_headers()
        self.wfile.write(out)
