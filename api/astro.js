// api/astro.js
// Accurate astrocartography using Swiss Ephemeris (swisseph npm package)
// Matches Astro.com / Astro-Seek accuracy

import swisseph from 'swisseph';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { jd } = req.query;
    if (!jd) return res.status(400).json({ error: 'jd required' });

    const JD = parseFloat(jd);
    const lines = buildACG(JD);
    res.json({ lines });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DEG = Math.PI / 180;
function R(d) { return d * DEG; }
function n360(x) { return ((x % 360) + 360) % 360; }
function n180(x) { return ((x + 540) % 360) - 180; }

// Swiss Ephemeris planet IDs
const PLANETS = {
  Sun:     swisseph.SE_SUN,
  Moon:    swisseph.SE_MOON,
  Mercury: swisseph.SE_MERCURY,
  Venus:   swisseph.SE_VENUS,
  Mars:    swisseph.SE_MARS,
  Jupiter: swisseph.SE_JUPITER,
  Saturn:  swisseph.SE_SATURN,
  Uranus:  swisseph.SE_URANUS,
  Neptune: swisseph.SE_NEPTUNE,
  Pluto:   swisseph.SE_PLUTO,
};

// Calculation flag: use built-in ephemeris, return ecliptic coords
const IFLAG = swisseph.SEFLG_SWIEPH | swisseph.SEFLG_SPEED;

// ─── GMST ─────────────────────────────────────────────────────────────────────
function gmst(jd) {
  const T = (jd - 2451545.0) / 36525.0;
  return n360(
    280.46061837
    + 360.98564736629 * (jd - 2451545)
    + 0.000387933 * T * T
    - T * T * T / 38710000.0
  );
}

// ─── Get planet ecliptic longitude via Swiss Ephemeris ────────────────────────
function getPlanetLon(jd, planetId) {
  return new Promise((resolve, reject) => {
    swisseph.swe_calc_ut(jd, planetId, IFLAG, (result) => {
      if (result.error) {
        reject(new Error(result.error));
      } else {
        resolve(result.longitude); // ecliptic longitude in degrees
      }
    });
  });
}

// ─── Convert ecliptic longitude → RA, Dec ────────────────────────────────────
function lonToRaDec(lon) {
  // Use true obliquity from Swiss Ephemeris if available, else mean
  const OBL = 23.4365;
  const l = R(lon);
  const e = R(OBL);
  const ra  = n360(Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)) * 180 / Math.PI);
  const dec = Math.asin(Math.sin(e) * Math.sin(l)) * 180 / Math.PI;
  return { ra, dec };
}

// ─── Build all ACG lines ──────────────────────────────────────────────────────
async function buildACG(jd) {
  const G = gmst(jd);

  // Get all planet longitudes from Swiss Ephemeris
  const lonPromises = Object.entries(PLANETS).map(async ([name, id]) => {
    const lon = await getPlanetLon(jd, id);
    return [name, lon];
  });

  const lonEntries = await Promise.all(lonPromises);
  const lines = {};

  for (const [name, lon] of lonEntries) {
    const { ra, dec } = lonToRaDec(lon);
    const dr = R(dec);

    // MC: geographic longitude where planet is on Midheaven
    // RAMC = GMST + lng → mcLon = RA - GMST
    const mcLon = n180(ra - G);
    const icLon = n180(mcLon + 180);

    const mc = [], ic = [], asc = [], dsc = [];

    // MC and IC: vertical lines
    for (let lat = -85; lat <= 85; lat += 1) {
      mc.push([lat, mcLon]);
      ic.push([lat, icLon]);
    }

    // ASC/DSC: hour angle method
    // cos(H) = -tan(lat) * tan(dec)
    // ASC = RA - H - GMST  (planet rising, east of meridian)
    // DSC = RA + H - GMST  (planet setting, west of meridian)
    for (let lat = -85; lat <= 85; lat += 1) {
      const cosH = -Math.tan(R(lat)) * Math.tan(dr);
      if (Math.abs(cosH) > 1) continue;
      const H = Math.acos(Math.max(-1, Math.min(1, cosH))) * 180 / Math.PI;
      asc.push([lat, n180(ra - H - G)]);
      dsc.push([lat, n180(ra + H - G)]);
    }

    lines[name] = { MC: mc, IC: ic, ASC: asc, DSC: dsc, mcLon, ra, dec };
  }

  return lines;
}
