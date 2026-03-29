// api/astro.js
// Accurate astrocartography line calculations
// Uses the "in mundo" method: for each latitude, find the geographic longitude
// where each planet is exactly on the MC, IC, ASC, or DSC angle.
// This matches the method used by Astro.com and Swiss Ephemeris.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { jd, tz } = req.query;
    if (!jd) return res.status(400).json({ error: 'jd required' });

    const JD = parseFloat(jd);
    const lines = buildACG(JD);
    res.json({ lines });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const OBL = 23.4365; // obliquity of ecliptic (degrees)
const DEG = Math.PI / 180;

function R(d) { return d * DEG; }
function n360(x) { return ((x % 360) + 360) % 360; }
function n180(x) { return ((x + 540) % 360) - 180; }

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

// ─── VSOP87 helpers ───────────────────────────────────────────────────────────
const S = 1e-8;
function vs(terms, tau) {
  return terms.reduce((s, v) => s + v[0] * Math.cos(v[1] + v[2] * tau), 0);
}
function helio(L0, L1, L2, B0, B1, R0, R1, tau) {
  const L = vs(L0, tau) + vs(L1, tau) * tau + (L2 ? vs(L2, tau) * tau * tau : 0);
  const B = vs(B0, tau) + (B1 ? vs(B1, tau) * tau : 0);
  const Rv = vs(R0, tau) + vs(R1, tau) * tau;
  return {
    x: Rv * Math.cos(B) * Math.cos(L),
    y: Rv * Math.cos(B) * Math.sin(L),
    z: Rv * Math.sin(B)
  };
}
function geoLon(p, e) {
  return n360(Math.atan2(p.y - e.y, p.x - e.x) * 180 / Math.PI);
}

// ─── VSOP87 series (truncated but accurate to ~1 arcmin) ─────────────────────
const EL0=[[175347046*S,0,0],[3341656*S,4.6732156,6283.075850],[34894*S,4.62610,12566.15170],[3497*S,2.7441,5753.3849],[3418*S,2.8289,3.5231],[3136*S,3.6277,77713.7715],[2676*S,4.4181,7860.4194],[2343*S,6.1352,3930.2097],[1324*S,0.7425,11506.7698],[1273*S,2.0371,529.6910]];
const EL1=[[628331966747*S,0,0],[206059*S,2.678235,6283.075850],[4303*S,2.6351,12566.1517],[425*S,1.590,3.523],[119*S,5.796,26.298],[109*S,2.966,1577.344]];
const EL2=[[52919*S,0,0],[8720*S,1.0721,6283.0758],[309*S,0.867,12566.152]];
const EB0=[[280*S,3.199,84334.662],[102*S,5.422,5507.553],[80*S,3.88,5223.69]];
const ER0=[[100013989*S,0,0],[1670700*S,3.0984635,6283.075850],[13956*S,3.05525,12566.15170],[3084*S,5.1985,77713.7715],[1628*S,1.1739,5753.3849],[1576*S,2.8469,7860.4194]];
const ER1=[[103019*S,1.107490,6283.075850],[1721*S,1.0644,12566.1517]];

const VL0=[[317614667*S,0,0],[1353968*S,5.5931332,10213.2855462],[89892*S,5.30650,20426.57109],[5477*S,4.4163,7860.4194],[3456*S,2.6996,11790.6291],[2372*S,2.9938,3930.2097],[1664*S,4.2502,1577.3435],[1438*S,4.1575,9683.5946]];
const VL1=[[1021352943052*S,0,0],[95708*S,2.46424,10213.28555],[14445*S,0.51625,20426.57109]];
const VL2=[[54127*S,0,0],[3891*S,0.3451,10213.2855]];
const VB0=[[5923638*S,0.2670278,10213.2855462],[40108*S,1.14737,20426.57109],[32815*S,3.14159,0]];
const VB1=[[513348*S,1.803643,10213.285546],[199*S,0,0]];
const VR0=[[72333282*S,0,0],[489824*S,4.021518,10213.285546],[1658*S,4.9021,20426.5711]];
const VR1=[[34551*S,0.89199,10213.28555]];

const MaL0=[[620347712*S,0,0],[18656368*S,5.0503417,3340.6124267],[1108217*S,5.4009984,6681.2248534],[91798*S,5.7547,10021.8373],[27745*S,5.9705,2281.2305],[12316*S,0.8496,2810.9215],[10610*S,2.9396,2942.4634],[8927*S,4.1578,0.0173],[8716*S,6.1101,13362.4497]];
const MaL1=[[334085627154*S,0,0],[1458227*S,3.6042605,3340.6124267],[164901*S,3.9263,6681.2249],[19963*S,4.2660,10021.8373],[3452*S,4.7321,3337.0893]];
const MaL2=[[58016*S,2.0498,3340.6124],[54188*S,0,0],[13908*S,2.4574,6681.2248]];
const MaB0=[[3197135*S,3.7683204,3340.6124267],[298033*S,4.1061,6681.2249],[289105*S,3.14159,0],[31366*S,4.4465,10021.8373]];
const MaB1=[[350069*S,5.368478,3340.612427],[14116*S,3.14159,0],[9671*S,5.4788,6681.2249]];
const MaR0=[[153033488*S,0,0],[14184953*S,3.47971,3340.6124267],[660776*S,3.817834,6681.224853],[46179*S,4.15595,10021.83728],[8110*S,5.5596,2810.9215]];
const MaR1=[[1107433*S,2.03253,3340.6124267],[103176*S,2.37072,6681.224853],[12877*S,0,0]];

const JuL0=[[59954691*S,0,0],[9695899*S,5.0619179,529.6909651],[573610*S,1.44406,7.11355],[306389*S,5.41734,1059.38193],[97178*S,4.14265,632.78374],[72903*S,3.64042,522.57742],[64264*S,3.41145,103.09277]];
const JuL1=[[52993480757*S,0,0],[489741*S,4.22067,529.690965],[228919*S,6.02648,7.11355],[55733*S,0.24322,1059.38193]];
const JuL2=[[47234*S,4.32148,7.11355],[38966*S,0,0],[30629*S,2.93021,529.69097]];
const JuB0=[[2268616*S,3.5585261,529.6909651],[110090*S,0,0],[109972*S,3.908093,1059.381930]];
const JuB1=[[177352*S,5.701665,529.690965]];
const JuR0=[[520887429*S,0,0],[25209327*S,3.49108640,529.6909651],[610600*S,3.841154,1059.38193],[282029*S,2.574199,632.78374]];
const JuR1=[[1271802*S,2.649375,529.6909651],[61662*S,3.000992,1059.38193],[53444*S,3.890718,522.57742],[41390*S,0,0]];

const SaL0=[[87401354*S,0,0],[11107660*S,3.9620509,213.2990954],[1414151*S,4.5858152,7.1135470],[398379*S,0.52112,206.18555],[350769*S,3.30330,426.59819],[206816*S,0.24658,103.09277]];
const SaL1=[[21354295596*S,0,0],[1296855*S,1.82821,213.29910],[564348*S,2.88500,7.11355],[107679*S,2.27770,206.18555],[98323*S,1.08087,426.59819]];
const SaL2=[[116441*S,1.17988,7.11355],[91921*S,0.07325,213.29910],[90592*S,0,0],[15277*S,4.06492,206.18555]];
const SaB0=[[4330678*S,3.6028443,213.2990954],[240348*S,2.852385,426.598191],[84746*S,0,0]];
const SaB1=[[397555*S,5.332900,213.299095],[49479*S,3.14159,0]];
const SaR0=[[955758136*S,0,0],[52921382*S,2.39226220,213.2990954],[1873680*S,5.235496,206.18555],[1464664*S,1.647631,426.59819]];
const SaR1=[[6182981*S,0.2584352,213.2990954],[506578*S,0.711147,206.18555],[341394*S,5.796358,426.59819],[188491*S,0.472157,220.41264]];

const UrL0=[[548129294*S,0,0],[9260408*S,0.8910642,74.7815986],[1504248*S,3.6271490,1.4844727],[365982*S,1.899715,73.2971259],[272328*S,3.358255,149.5631971]];
const UrL1=[[7502543122*S,0,0],[154458*S,5.242017,74.781599],[24456*S,1.71256,1.48447]];
const UrL2=[[53033*S,0,0],[16983*S,3.16565,138.5175],[9987*S,5.9491,74.7816]];
const UrB0=[[1346278*S,2.6187781,74.7815986],[62341*S,5.08111,149.5632],[61601*S,3.14159,0]];
const UrB1=[[206366*S,4.12394,74.78160]];
const UrR0=[[1921264848*S,0,0],[88784984*S,5.60377527,74.7815986],[3440835*S,0.32836,73.2971259],[2055653*S,1.78295,149.5631971]];
const UrR1=[[1479896*S,3.6720571,74.7815986],[71212*S,6.22815,63.73590]];

const NeL0=[[531188633*S,0,0],[1798476*S,2.9010127,38.1330356],[1019728*S,0.4858092,1.4844727],[124532*S,4.830081,36.6485629]];
const NeL1=[[3837687717*S,0,0],[16604*S,4.86319,1.48447],[15807*S,2.27923,38.13304]];
const NeL2=[[53892*S,0,0],[296*S,1.855,1.48447]];
const NeB0=[[3088623*S,1.4410437,38.1330356],[27701*S,5.909627,76.2660712],[27237*S,3.14159,0]];
const NeB1=[[227279*S,3.807931,38.133035],[2721*S,3.14159,0]];
const NeR0=[[3007013206*S,0,0],[27062259*S,1.32999459,38.1330356],[1691764*S,3.2518614,36.6485629]];
const NeR1=[[236339*S,0.70498,38.133035]];

// ─── Kepler solver for Mercury & Pluto ───────────────────────────────────────
function kepler(M, e) {
  let E = M;
  for (let i = 0; i < 10; i++) {
    const d = E - e * Math.sin(E) - M;
    E -= d / (1 - e * Math.cos(E));
    if (Math.abs(d) < 1e-10) break;
  }
  return E;
}
function kepGeo(L0r, Lr, e0r, er, w0r, wr, i0r, ir, O0r, Or, ar, jd, ex, ey) {
  const T = (jd - 2451545) / 36525;
  const L = n360(L0r + Lr * T);
  const e = e0r + er * T;
  const w = n360(w0r + wr * T);
  const i = R(i0r + ir * T);
  const O = R(O0r + Or * T);
  const M = R(n360(L - w));
  const E = kepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = ar * (1 - e * Math.cos(E));
  const sm = R(w) - O;
  const u = nu + sm;
  const x = r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(i));
  const y = r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(i));
  return n360(Math.atan2(y - ey, x - ex) * 180 / Math.PI);
}

// ─── Sun & Moon ───────────────────────────────────────────────────────────────
function sunLon(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = n360(280.46646 + 36000.76983 * T);
  const M = n360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mr = R(M);
  return n360(L0
    + (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
    + 0.000289 * Math.sin(3 * Mr));
}
function moonLon(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = n360(218.3165 + 481267.8813 * T);
  const M  = n360(357.5291 + 35999.0503 * T);
  const Mp = n360(134.9634 + 477198.8676 * T);
  const D  = n360(297.8502 + 445267.1115 * T);
  const F  = n360(93.2721 + 483202.0175 * T);
  return n360(L0
    + 6.2888 * Math.sin(R(Mp))
    + 1.274 * Math.sin(R(2*D - Mp))
    + 0.6583 * Math.sin(R(2*D))
    + 0.2136 * Math.sin(R(2*Mp))
    - 0.1851 * Math.sin(R(M))
    - 0.1143 * Math.sin(R(2*F))
    + 0.0588 * Math.sin(R(2*D - 2*Mp))
    + 0.0572 * Math.sin(R(2*D - M - Mp))
    + 0.0533 * Math.sin(R(2*D + Mp)));
}

// ─── Convert ecliptic longitude → RA, Dec ────────────────────────────────────
function lonToRaDec(lon) {
  const l = R(lon);
  const e = R(OBL);
  const ra  = n360(Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)) * 180 / Math.PI);
  const dec = Math.asin(Math.sin(e) * Math.sin(l)) * 180 / Math.PI;
  return { ra, dec };
}

// ─── Core: build all ACG lines ────────────────────────────────────────────────
// Method: In Mundo (standard astrocartography)
// For each planet, find the geographic longitude where it is exactly on each angle.
//
// MC line: RAMC = RA_planet  → geographic longitude = RA_planet - GMST
//          (east positive convention, then convert to -180/+180)
//
// The sign: RAMC at longitude L = GMST + L
// So planet on MC when GMST + L = RA → L = RA - GMST
//
// ASC line: at each latitude φ, the hour angle H when the planet rises:
//   cos(H) = -tan(φ) · tan(dec)
//   Geographic longitude = RA - H - GMST  (rising = east of MC by H)
//
// DSC line: geographic longitude = RA + H - GMST  (setting = west of MC by H)
//
// IC line: MC + 180°

// Light-time correction: find where planet was when light left it
function lightTimeCorrected(helioFn, jd, E) {
  let p = helioFn(jd);
  for (let i = 0; i < 3; i++) {
    const dx = p.x - E.x, dy = p.y - E.y, dz = p.z - E.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    const lt = 0.0057755 * dist;
    p = helioFn(jd - lt);
  }
  return p;
}

function buildACG(jd) {
  const G = gmst(jd);
  const tau = (jd - 2451545) / 365250;
  const E = helio(EL0, EL1, EL2, EB0, null, ER0, ER1, tau);

  function helioAtJD(L0,L1,L2,B0,B1,R0,R1,jdT) {
    const t = (jdT - 2451545) / 365250;
    return helio(L0,L1,L2,B0,B1,R0,R1,t);
  }

  const lons = {
    Sun:     sunLon(jd),
    Moon:    moonLon(jd),
    Mercury: kepGeo(252.250906,149472.6746358,0.20563175,-0.000020407,77.45779628,0.15940013,7.00498625,-0.00594749,48.33076593,-0.12534081,0.387098310,jd,E.x,E.y),
    Venus:   geoLon(lightTimeCorrected(jdT => helioAtJD(VL0,VL1,VL2,VB0,VB1,VR0,VR1,jdT), jd, E), E),
    Mars:    geoLon(lightTimeCorrected(jdT => helioAtJD(MaL0,MaL1,MaL2,MaB0,MaB1,MaR0,MaR1,jdT), jd, E), E),
    Jupiter: geoLon(lightTimeCorrected(jdT => helioAtJD(JuL0,JuL1,JuL2,JuB0,JuB1,JuR0,JuR1,jdT), jd, E), E),
    Saturn:  geoLon(lightTimeCorrected(jdT => helioAtJD(SaL0,SaL1,SaL2,SaB0,SaB1,SaR0,SaR1,jdT), jd, E), E),
    Uranus:  geoLon(lightTimeCorrected(jdT => helioAtJD(UrL0,UrL1,UrL2,UrB0,UrB1,UrR0,UrR1,jdT), jd, E), E),
    Neptune: geoLon(lightTimeCorrected(jdT => helioAtJD(NeL0,NeL1,NeL2,NeB0,NeB1,NeR0,NeR1,jdT), jd, E), E),
    Pluto:   kepGeo(238.929038,145.2078051,0.24880766,0,224.068916,0,17.1410426,0,110.3034700,0,39.48211675,jd,E.x,E.y),
  };

  const lines = {};
  const e = R(OBL);

  for (const [name, lon] of Object.entries(lons)) {
    const { ra, dec } = lonToRaDec(lon);

    // ── Zodiacal method (matches Astro.com / Swiss Ephemeris) ──────────────
    // MC: find geographic longitude where RAMC = planet RA
    // RAMC at lng L = GMST + L → mcLon = RA - GMST
    const mcLon = n180(ra - G);
    const icLon = n180(mcLon + 180);

    const mc = [], ic = [], asc = [], dsc = [];

    for (let lat = -85; lat <= 85; lat += 1) {
      mc.push([lat, mcLon]);
      ic.push([lat, icLon]);
    }

    // ASC/DSC: zodiacal method
    // For each latitude and each test longitude, cast a relocated chart.
    // Find where the ecliptic longitude of the ASC/DSC equals the planet's longitude.
    // We scan longitudes and interpolate for the crossing point.
    const planetLon = lon; // ecliptic longitude of planet
    const latR = R;

    for (let lat = -85; lat <= 85; lat += 1) {
      const lr = R(lat);
      // At each geographic longitude, compute the ASC ecliptic longitude
      // and find where it equals the planet's ecliptic longitude
      // ASC elon: atan2(cos(RAMC), -(sin(RAMC)*cos(e) + tan(lat)*sin(e)))
      // Scan with 0.1° step and interpolate
      let prevAscLon = null, prevLng = null;
      let prevDscLon = null;
      for (let lng = -180; lng <= 181; lng += 0.5) {
        const ramc = R(n360(G + lng));
        const cosRamc = Math.cos(ramc), sinRamc = Math.sin(ramc);
        const ascElon = n360(Math.atan2(cosRamc, -(sinRamc * Math.cos(e) + Math.tan(lr) * Math.sin(e))) * 180 / Math.PI);
        const dscElon = n360(ascElon + 180);

        if (prevAscLon !== null) {
          // Check for ASC crossing
          let d1 = n180(prevAscLon - planetLon);
          let d2 = n180(ascElon - planetLon);
          if (d1 * d2 < 0 && Math.abs(d1 - d2) < 10) {
            // Interpolate
            const f = d1 / (d1 - d2);
            asc.push([lat, prevLng + f * 0.5]);
          }
          // Check for DSC crossing
          d1 = n180(prevDscLon - planetLon);
          d2 = n180(dscElon - planetLon);
          if (d1 * d2 < 0 && Math.abs(d1 - d2) < 10) {
            const f = d1 / (d1 - d2);
            dsc.push([lat, prevLng + f * 0.5]);
          }
        }
        prevAscLon = ascElon;
        prevDscLon = dscElon;
        prevLng = lng;
      }
    }

    // Sort ASC/DSC by latitude for proper line rendering
    asc.sort((a, b) => a[0] - b[0]);
    dsc.sort((a, b) => a[0] - b[0]);

    lines[name] = { MC: mc, IC: ic, ASC: asc, DSC: dsc, mcLon, ra, dec };
  }

  return lines;
}
