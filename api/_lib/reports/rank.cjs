// Prototype ranking for the Love / Career / Home reports (copied from the project's reports-engine/rank.js).
//   node rank.js <chart.json> [theme]
const fs = require('fs');
global.window = undefined;
eval(fs.readFileSync(__dirname + '/engine.js', 'utf8'));
const E = globalThis.elsewhereEngine;

const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const RULER = { Aries:'Mars', Taurus:'Venus', Gemini:'Mercury', Cancer:'Moon', Leo:'Sun', Virgo:'Mercury',
  Libra:'Venus', Scorpio:'Mars', Sagittarius:'Jupiter', Capricorn:'Saturn', Aquarius:'Saturn', Pisces:'Jupiter' };
const NAME = { NNode: 'North Node' };
const n360 = x => ((x % 360) + 360) % 360;
const signOf = lon => SIGNS[Math.floor(n360(lon) / 30)];

const THEMES = {
  love: {
    label: 'Love',
    planets: { Venus: 1.0, NNode: 0.5, Sun: 0.8, Moon: 0.5, Jupiter: 0.6 },   // Oct 29 (Sarah, Amenia vs North Platte): Sun 0.6→0.8, Jupiter 0.5→0.6, North Node 0.8→0.5 (a point, not a planet)
    rulerOf: [5, 7], rulerWeight: 0.6,
    angles: { DSC: 1.0, ASC: 0.4, IC: 0.3, MC: 0.2 },
    houses: [7, 5],
    occupancy: { 7: 0.1 },
    blockAt: ['DSC', 'ASC'],
    pairMatters: true,
    leadDynamic: 0.4,
    onlyAt: { Sun: ['DSC'], Moon: ['DSC'], NNode: ['DSC'] },
    maleficDynamic: -0.3
  },
  career: {
    label: 'Career',
    planets: { Sun: 1.0, Jupiter: 0.8, Uranus: 0.8, Saturn: 0.7, Mars: 0.5 },
    rulerOf: [10], rulerWeight: 0.7,
    angles: { MC: 1.0, ASC: 0.2, DSC: 0.1, IC: 0.2 },
    blockAt: ['DSC', 'IC'],
    icOnly: ['Sun', 'Jupiter'],
    onlyAt: { Uranus: ['MC'] },
    houses: [10, 2, 1],
    houseWeight: { 2: 0.7, 1: 0.4 },
    rulerHouses: [10, 2],
    mcRulerMatch: true,
    maleficDynamic: 0.2,
    companionCounts: true
  },
  // Oct 30 (Sarah): the third report is Home ("where you feel at home and at peace"), replacing Healing.
  // Read from the IC and the relocated 4th house. The Moon, Venus, Jupiter and Neptune near the IC are home
  // signatures; strong planets in the chart add by Map Guide strength (Sarah's Mars). Uranus (change) is out.
  home: {
    label: 'Home',
    planets: { Moon: 1.0, Venus: 0.8, Jupiter: 0.8, Neptune: 0.6, Sun: 0.5, NNode: 0.3 },
    rulerOf: [4], rulerWeight: 0.6,
    angles: { IC: 1.0, ASC: 0.3, DSC: 0.3, MC: 0.2 },
    houses: [4, 12],
    houseWeight: { 12: 0.5 },
    onlyAt: { NNode: ['IC'] },
    occupancy: { 4: 0.15 },
    blockAt: ['IC'],
    maleficDynamic: -0.3
  }
};
const HARD = { Mars: 1.0, Saturn: 1.0, Pluto: 0.8, Uranus: 0.5 };
const TIGHT = process.env.TIGHT !== '0';
const LOVEVERDICT = process.env.LOVEVERDICT !== '0';
const MGSTRENGTH = process.env.MGSTRENGTH !== '0';
const MGCROSS = process.env.MGCROSS !== '0';
const LINECAP = process.env.LINECAP === '1';
const CHIRONX = process.env.CHIRONX !== '0';   // off: it broke Mom's approved Venus-DC Mexico list (Oct 30)
const CUSP = process.env.CUSP !== '0';
const SOFTMC = process.env.SOFTMC !== '0';
const CHIRONLINE = process.env.CHIRONLINE !== '0';
const CHIRON_W = +(process.env.CHIRON_W || 0.6);
if (process.env.CHIRON) HARD.Chiron = +process.env.CHIRON;   // test: Chiron lines as a hard planet
const VALUE = { harmonious: 1.0, dynamic: 0.4, challenging: -0.8 };
const MALEFIC = ['Mars', 'Saturn', 'Pluto'];
const PARAN_WEIGHT = 0.6;
const LEAD_DYNAMIC = 0.8;
const valueFor = (p, cat, T) => (MALEFIC.includes(p) && cat === 'dynamic') ? T.maleficDynamic
  : (cat === 'dynamic' && T.planets[p] === 1.0) ? (T.leadDynamic != null ? T.leadDynamic : LEAD_DYNAMIC) : VALUE[cat];
const prox = d => d <= 150 ? 1 : Math.max(0, 1 - (d - 150) / 650);
const ANG = { MC: 'MC', IC: 'IC', ASC: 'AC', DSC: 'DC' };
const orbProx = o => o <= 3 ? 1 : Math.max(0, 1 - (o - 3) / 7);
const orbTight = o => o <= 2 ? 1 : Math.max(0, 1 - (o - 2) / 3);
// Oct 25 (Sarah: Havana on Chiron's MC, Franca on Chiron's IC): measure a planet's
// distance from an angle the way the map draws its line: degrees of longitude
// from the line at the city's latitude (in mundo). The zodiac-degree measure
// drifts from the map by several degrees for planets far off the ecliptic
// (Chiron, Pluto, the Moon). Run with MUNDO=1 to use it.
let CH = null;
const MUNDO = process.env.MUNDO !== '0';   // Oct 26 (Sarah): true positions, matching Neutrino (Franca: Chiron IC 202 km east)
const n180 = x => ((x + 540) % 360) - 180;
function mundane(P, city, ang) {
  const mcl = n180(P.ra - CH.gmst);
  if (ang === 'MC') return Math.abs(n180(city.lng - mcl));
  if (ang === 'IC') return Math.abs(n180(city.lng - mcl - 180));
  const ch = -Math.tan(city.lat * Math.PI / 180) * Math.tan(P.dec * Math.PI / 180);
  if (Math.abs(ch) > 1) return 99;
  const H = Math.acos(ch) * 180 / Math.PI;
  return Math.abs(n180(city.lng - (ang === 'ASC' ? P.ra - H : P.ra + H) + CH.gmst));
}
function angleOrb(lon, city, ang) {
  const at = { ASC: city.asc, DSC: city.asc + 180, MC: city.mc, IC: city.mc + 180 }[ang];
  if (at == null) return 99;
  if (MUNDO && CH && CH.gmst != null) {
    const P = Object.values(CH.planets).find(q => q.lon === lon);
    if (P && P.ra != null) return mundane(P, city, ang);
  }
  const d = n360(lon - at); return Math.min(d, 360 - d);
}
function closeness(p, ang, city, chart) {
  const d = city.dist[p][ang], o = angleOrb(chart.planets[p].lon, city, ang);
  const f = orbProx(o);
  return { f, label: `${o.toFixed(1)}° from the ${ANG[ang]}` };
}
function houseOf(lon, cusps) {
  for (let i = 0; i < 12; i++) {
    const a = cusps[i], b = cusps[(i + 1) % 12];
    if (n360(lon - a) < n360(b - a)) {
      // Oct 25 (Sarah, Rio: Sun 1.6° before the DC): a planet within 3° before an
      // angle (1st, 4th, 7th, 10th cusp) is read in that angular house.
      const nx = (i + 1) % 12;
      if (CUSP && [0, 3, 6, 9].includes(nx) && n360(b - lon) <= 3) return nx + 1;
      return i + 1;
    }
  }
  return 1;
}
function natalPlanets(chart) {
  const p = {};
  for (const [n, v] of Object.entries(chart.planets)) {
    const s = n360(v.lon) % 30;
    p[n] = { totalDeg: n360(v.lon), sign: signOf(v.lon), deg: Math.floor(s), min: Math.floor((s % 1) * 60) };
  }
  const c = chart.natal.cusps;
  p.Ascendant = { totalDeg: chart.natal.asc, sign: signOf(chart.natal.asc) };
  p.Midheaven = { totalDeg: chart.natal.mc, sign: signOf(chart.natal.mc) };
  p._houses = {}; c.forEach((x, i) => p._houses[String(i + 1)] = x);
  return p;
}

// Oct 28 (Sarah, Dublin): Uranus × Pluto crossings are generational, so they weigh a third (0.2, was 0.6).
// Oct 28: caution places are chosen by what is really there (lines, crossings, a ruler on an angle).
const lineOnly = x => !x.reloc || /sits [\d.]+° from/.test(x.why);
const hardScore = r => r.care.filter(lineOnly).reduce((s, x) => s + x.s, 0) - 0.5 * r.best.filter(lineOnly).reduce((s, x) => s + x.s, 0);
const NCARE = +(process.env.NCARE || 3);   // Oct 28: 3 places to avoid per report (Sarah)
function rank(chart, themeKey, allowed, careAllowed) {
  CH = chart;
  const T = THEMES[themeKey];
  const P = natalPlanets(chart);
  const A = E.analyzeChart(P);
  const verdict = {};
  for (const n of Object.keys(A.planets)) verdict[n] = E.categorizeLine(n, A);
  if (process.env.VERDICT) for (const kv of process.env.VERDICT.split(',')) { const [n, cat] = kv.split(':'); verdict[n] = Object.assign({}, verdict[n], { category: cat }); }

  const weights = Object.assign({}, T.planets);
  // Oct 29 (Sarah: North Platte vs Amenia): in love, a planet counts by how well it sits in the chart.
  // A Venus the Map Guide calls dynamic (Sarah's, −1) no longer outranks a harmonious Sun on the DC.
  if (T.pairMatters && LOVEVERDICT) for (const p of Object.keys(weights)) { const c = verdict[p] && verdict[p].category; weights[p] *= c === 'challenging' ? 0.5 : c === 'dynamic' ? 0.75 : 1; }
  // Oct 30 (Sarah, Mom's money map in Neutrino: Moon MC first): a planet that is strong in the chart
  // counts in every report by its Map Guide strength (Mom's Moon, +10, now leads her career report).
  if (MGSTRENGTH) for (const p of Object.keys(A.planets)) { const q = A.planets[p].score; if (q > 0 && verdict[p] && verdict[p].category === 'harmonious') weights[p] = Math.max(weights[p] || 0, 0.8 * Math.min(1, q / 5)); }   // +5 or more counts in full (Sarah's Mars, +3: 0.48)
  const rulerNotes = [];
  for (const h of T.rulerOf) {
    const r = RULER[signOf(chart.natal.cusps[h - 1])];
    rulerNotes.push(`${r} rules your natal ${h}${['th','st','nd','rd'][h] || 'th'}`);
    weights[r] = Math.max(weights[r] || 0, T.rulerWeight);
  }

  const companion = {};
  for (const p of Object.keys(HARD)) {
    if (!verdict[p] || verdict[p].category === 'challenging') continue;
    for (const [q, w] of Object.entries(weights)) {
      if (q === p || !verdict[q] || verdict[q].category !== 'harmonious') continue;
      const d = Math.abs(n360(chart.planets[p].lon - chart.planets[q].lon)); const sep = Math.min(d, 360 - d);
      if (sep <= 5) companion[p] = q;
    }
  }
  const noLines = {};
  const voice = p => (T.companionCounts && companion[p]) ? companion[p] : p;
  if (T.companionCounts) for (const [p, q] of Object.entries(companion)) weights[p] = Math.max(weights[p] || 0, 0.8 * weights[q]);
  else if (T.pairMatters) for (const q of Object.values(companion)) { weights[q] *= 0.5; noLines[q] = true; }
  const W0 = Object.assign({}, weights);   // the planet weights this report uses (for "your top lines")

  const chironFused = Object.keys(chart.planets).some(q => q !== 'Chiron' && verdict[q] && verdict[q].category === 'challenging' &&
    (d => Math.min(d, 360 - d))(Math.abs(n360(chart.planets.Chiron.lon - chart.planets[q].lon))) <= 5);
  const moonWeak = T.pairMatters && verdict.Moon && verdict.Moon.category !== 'harmonious';
  if (moonWeak) delete weights.Moon;
  const results = chart.cities.map(city => {
    const intense = new Set();
    const best = [], care = [], neutral = [];
    // 1) Lines of the theme planets
    for (const [p, w] of Object.entries(weights)) {
      const v = verdict[voice(p)]; if (!v || noLines[p]) continue;
      if (MALEFIC.includes(p) && v.category !== 'harmonious' && T.maleficDynamic <= 0) continue;
      for (const [ang, aw] of Object.entries(T.angles)) {
        if (T.onlyAt && T.onlyAt[p] && !T.onlyAt[p].includes(ang)) continue;
        if (T.icOnly && ang === 'IC' && !T.icOnly.includes(p)) continue;
        if (MALEFIC.includes(voice(p)) && v.category === 'dynamic' && !['MC', 'ASC'].includes(ang)) continue;
        if (p === 'Saturn' && ang === 'MC' && v.category !== 'harmonious') continue;
        let c = closeness(p, ang, city, chart);
        if (p === 'NNode') { const o = angleOrb(chart.planets[p].lon, city, ang); c = { f: Math.max(0, 1 - o / 4), label: o.toFixed(1) + '° from the ' + ANG[ang] }; }
        if (!c.f) continue;
        const val = valueFor(voice(p), v.category, T) * w * aw * c.f;
        const why = `${NAME[p] || p} ${ANG[ang]} · ${c.label} (${v.category})`;
        if (val > 0) best.push({ s: val, why, line: p + ang });
        else care.push({ s: -val, why, line: p + ang, pa: p + '|' + ang });
      }
    }
    // 1b) Parans
    // Oct 30 (Sarah, Porto: Neutrino calls her Saturn DC × Pluto IC "Supportive"): a crossing is judged by how its
    // planets sit in this chart. Mars, Saturn or Pluto make a crossing hard only when the Map Guide scores them below zero.
    // Oct 31 (Sarah, Paris: Neutrino rates Saturn × Chiron "very challenging", Jupiter × Chiron "challenging",
    // Mars × Chiron "neutral" with her +3 Mars): Chiron makes a crossing hard by its nature, whatever its score.
    const chironX = (pr, f) => { if (![pr.p1, pr.p2].includes('Chiron')) return null; const o = pr.p1 === 'Chiron' ? pr.p2 : pr.p1;
      const q = A.planets[o] ? A.planets[o].score : 0; if (q >= 3) return null;
      return { s: (['Saturn', 'Pluto'].includes(o) || q < 0 ? 0.6 : 0.35) * f,   // heavy with Saturn, Pluto or any planet the chart makes hard (Sarah's Mercury)
        why: `Paran: ${NAME[pr.p1] || pr.p1} ${ANG[pr.a1]} with ${NAME[pr.p2] || pr.p2} ${ANG[pr.a2]} (${Math.abs(pr.lat).toFixed(1)}°${pr.lat >= 0 ? 'N' : 'S'}) — ${NAME[o] || o} with Chiron: old wounds`, line: 'paran' }; };
    const mgNeg = q => !MGCROSS ? (verdict[q] && verdict[q].category !== 'harmonious') : (A.planets[q] ? A.planets[q].score < 0 : false) || (verdict[q] && verdict[q].category === 'challenging');
    for (const pr of (chart.parans || [])) {
      // Memory (Oct 25): skip crossings whose latitude band doesn't reach this city.
      // They score nothing; before, every city stored every crossing as a "neutral" note.
      if (Math.abs(city.lat - pr.lat) >= 1.5) continue;
      { const fx = Math.max(0, 1 - Math.abs(city.lat - pr.lat) / 1.5) * Math.min(1, Math.max(0, (66 - Math.abs(pr.lat)) / 11));
        const cx = CHIRONX && !(T.pairMatters && [pr.p1, pr.p2].includes('Sun') && chironFused) ? chironX(pr, fx) : null; if (cx && fx) { care.push(cx); continue; } }
      // Sarah (Oct 25, Mom's chart, northern Florida): any Sun–Chiron crossing is a
      // love caution, on whatever angles: old wounds come up in partnership.
      // Refined the same evening (Sarah, Rio): only when Chiron was born beside a
      // challenging planet (Mom: Chiron 1° from her Saturn), so it carries that
      // planet's weight. Sarah's own Sun–Chiron crossing through Rio is positive.
      if (T.pairMatters && [pr.p1, pr.p2].includes('Sun') && [pr.p1, pr.p2].includes('Chiron') && chironFused) {
        const fz = Math.max(0, 1 - Math.abs(city.lat - pr.lat) / 1.5) * Math.min(1, Math.max(0, (66 - Math.abs(pr.lat)) / 11));
        if (fz) care.push({ s: 0.5 * fz, why: `Paran: ${NAME[pr.p1] || pr.p1} ${ANG[pr.a1]} with ${NAME[pr.p2] || pr.p2} ${ANG[pr.a2]} (${Math.abs(pr.lat).toFixed(1)}°${pr.lat >= 0 ? 'N' : 'S'}) — Sun with Chiron: old wounds in partnership`, line: 'paran' });
        continue;
      }
      // Oct 26 (Sarah, Chihuahua: Jupiter AC × Saturn IC): career crossings without a
      // planet on the MC can't lift a place, but a difficult planet in them still
      // weighs on it: a not-well-placed Saturn, Mars or Pluto, Chiron, or a planet the
      // Map Guide calls challenging.
      if (T.companionCounts && pr.a1 !== 'MC' && pr.a2 !== 'MC') {
        const hardQ = q => q === 'Chiron' || (verdict[q] && (verdict[q].category === 'challenging' || (['Mars', 'Saturn', 'Pluto'].includes(q) && mgNeg(q) && !companion[q])));
        const bad = [pr.p1, pr.p2].filter(hardQ);
        const fz = Math.max(0, 1 - Math.abs(city.lat - pr.lat) / 1.5) * Math.min(1, Math.max(0, (66 - Math.abs(pr.lat)) / 11));
        if (bad.length && fz) { const up = [pr.p1, pr.p2].includes('Uranus') && [pr.p1, pr.p2].includes('Pluto'); care.push({ s: (bad.length > 1 ? 0.5 : 0.35) * (up ? 1 / 3 : 1) * fz, why: `Paran: ${NAME[pr.p1] || pr.p1} ${ANG[pr.a1]} with ${NAME[pr.p2] || pr.p2} ${ANG[pr.a2]} (${Math.abs(pr.lat).toFixed(1)}°${pr.lat >= 0 ? 'N' : 'S'}) — ${bad.map(q => NAME[q] || q).join(' and ')} ${bad.length > 1 ? 'weigh' : 'weighs'} on it`, line: 'paran' }); continue; }
      }
      if (T.companionCounts && pr.a1 !== 'MC' && pr.a2 !== 'MC') { neutral.push({ s: 0, why: `Paran: ${NAME[pr.p1] || pr.p1} ${ANG[pr.a1]} with ${NAME[pr.p2] || pr.p2} ${ANG[pr.a2]} (${Math.abs(pr.lat).toFixed(1)}°${pr.lat >= 0 ? 'N' : 'S'})`, line: 'paran' }); continue; }
      // Oct 28 (Sarah, Guerrero Negro): a crossing that touches the MC used to be set aside
      // in love as "a career signature" before its planets were checked, so hard crossings
      // (Mercury × Chiron) counted for nothing. Hard ones now count as love cautions first.
      if (T.pairMatters && (pr.a1 === 'MC' || pr.a2 === 'MC')) {
        const fz = Math.max(0, 1 - Math.abs(city.lat - pr.lat) / 1.5) * Math.min(1, Math.max(0, (66 - Math.abs(pr.lat)) / 11));
        const dq = q => q === 'Chiron' || (verdict[q] && (verdict[q].category === 'challenging' || (['Mars', 'Saturn', 'Pluto'].includes(q) && mgNeg(q) && !companion[q])));
        const pw = `Paran: ${NAME[pr.p1] || pr.p1} ${ANG[pr.a1]} with ${NAME[pr.p2] || pr.p2} ${ANG[pr.a2]} (${Math.abs(pr.lat).toFixed(1)}°${pr.lat >= 0 ? 'N' : 'S'})`;
        if (fz && dq(pr.p1) && dq(pr.p2)) { care.push({ s: 0.6 * fz, why: pw + ' — two difficult planets', line: 'paran' }); continue; }
        if (fz && [pr.p1, pr.p2].includes('Uranus') && [pr.p1, pr.p2].includes('Pluto')) { care.push({ s: 0.2 * fz, why: pw + ' — Uranus with Pluto: upheaval', line: 'paran' }); continue; }
      }
      if (T.pairMatters && (pr.a1 === 'MC' || pr.a2 === 'MC') && ![pr.p1, pr.p2].some((q, i) => (q === 'Venus' || q === 'Sun') && [pr.a1, pr.a2][i] !== 'MC')) { neutral.push({ s: 0, why: `Paran: ${NAME[pr.p1] || pr.p1} ${ANG[pr.a1]} with ${NAME[pr.p2] || pr.p2} ${ANG[pr.a2]} — a career signature`, line: 'paran' }); continue; }
      if (T.pairMatters && [[pr.p1, pr.a1], [pr.p2, pr.a2]].some(([p, a]) => p === 'Sun' && a === 'DSC') && [pr.p1, pr.p2].includes('Moon')) continue;
      const polar = Math.min(1, Math.max(0, (66 - Math.abs(pr.lat)) / 11));
      const f = Math.max(0, 1 - Math.abs(city.lat - pr.lat) / 1.5) * polar; if (!f) continue;
      const w1 = weights[pr.p1] || 0, w2 = weights[pr.p2] || 0;
      const v1 = verdict[pr.p1], v2 = verdict[pr.p2]; if (!v1 || !v2) continue;
      const pwhy = `Paran: ${NAME[pr.p1] || pr.p1} ${ANG[pr.a1]} with ${NAME[pr.p2] || pr.p2} ${ANG[pr.a2]} (${Math.abs(pr.lat).toFixed(1)}°${pr.lat >= 0 ? 'N' : 'S'})`;
      { const difficult = q => q === 'Chiron' || (verdict[q] && (verdict[q].category === 'challenging' ||
          (['Mars', 'Saturn', 'Pluto'].includes(q) && mgNeg(q) && !companion[q])));
        if (difficult(pr.p1) && difficult(pr.p2)) { care.push({ s: 0.6 * f, why: pwhy + ' — two difficult planets', line: 'paran' }); continue; }
        if ([pr.p1, pr.p2].includes('Uranus') && [pr.p1, pr.p2].includes('Pluto')) { care.push({ s: 0.2 * f, why: pwhy + ' — Uranus with Pluto: upheaval', line: 'paran' }); continue; }
        const ch = [pr.p1, pr.p2].find(q => verdict[q] && verdict[q].category === 'challenging');
        // Oct 28 (Sarah, St. Petersburg vs Cairo/Durban): a challenging planet crossing an easy one is mild (0.2, was 0.4);
        // crossing Saturn or Chiron ("two difficult planets", above) is what makes a place hard.
        if (ch) { care.push({ s: 0.2 * f, why: pwhy + ` — ${ch} is challenging in your chart`, line: 'paran' }); continue; } }
      if (!w1 && !w2) {
        const aw2 = Math.max(T.angles[pr.a1] || 0, T.angles[pr.a2] || 0);
        const cat = p => (companion[p] && verdict[companion[p]]) ? verdict[companion[p]].category : verdict[p].category;
        const bad = [pr.p1, pr.p2].some(p => cat(p) === 'challenging' || (HARD[p] && mgNeg(p)));
        const good = [pr.p1, pr.p2].every(p => cat(p) === 'harmonious');
        const s0 = 0.3 * PARAN_WEIGHT * aw2 * f;
        if (bad) care.push({ s: s0, why: pwhy, line: 'paran' });
        else if (good) best.push({ s: s0, why: pwhy, line: 'paran' });
        else neutral.push({ s: 0, why: pwhy, line: 'paran' });
        continue;
      }
      const aw = ((T.angles[pr.a1] || 0) + (T.angles[pr.a2] || 0)) / 2;
      const hard = [pr.p1, pr.p2].filter(p => HARD[p] && !weights[p] && mgNeg(p) && !companion[p]);
      [pr.p1, pr.p2].forEach(p => { if (companion[p] && f > 0.3) intense.add(`${NAME[p] || p} with ${companion[p]}`); });
      const why = pwhy;
      if (hard.length) {
        const k = hard.some(p => verdict[p].category === 'challenging') ? 1 : 0.5;
        care.push({ s: PARAN_WEIGHT * Math.max(w1, w2) * aw * k * f, why, line: 'paran' });
      } else {
        const lead = w1 >= w2 ? pr.p1 : pr.p2, leadAng = lead === pr.p1 ? pr.a1 : pr.a2;
        if (T.onlyAt && T.onlyAt[lead] && !T.onlyAt[lead].includes(leadAng)) { neutral.push({ s: 0, why: pwhy, line: 'paran' }); continue; }
        if (T.icOnly && leadAng === 'IC' && !T.icOnly.includes(lead)) { neutral.push({ s: 0, why: pwhy, line: 'paran' }); continue; }
        if (['MC', 'IC', 'ASC', 'DSC'].some(a => a !== leadAng && closeness(lead, a, city, chart).f >= 0.9)) { neutral.push({ s: 0, why: pwhy + ' — its line here outweighs it', line: 'paran' }); continue; }
        const partner = lead === pr.p1 ? pr.p2 : pr.p1;
        const pv = verdict[companion[partner] || voice(partner)], pc = pv ? pv.category : 'dynamic';
        const malefic = (['Mars', 'Saturn', 'Pluto', 'Chiron'].includes(partner) || (T.companionCounts && partner === 'Neptune')) && !companion[partner];
        if (T.companionCounts && partner === 'Chiron' && (partner === pr.p1 ? pr.a1 : pr.a2) === 'MC') { care.push({ s: PARAN_WEIGHT * 0.5 * f, why: pwhy + ' — Chiron on the MC', line: 'paran' }); continue; }
        { const pa = partner === pr.p1 ? pr.a1 : pr.a2;
          if (partner === 'Saturn' && verdict.Saturn && verdict.Saturn.category !== 'harmonious' && (pa === 'ASC' || pa === 'MC') && !(T.pairMatters)) { care.push({ s: 0.4 * f, why: pwhy + ' — Saturn ' + ANG[pa] + ': burden', line: 'paran' }); continue; } }
        const pk = T.pairMatters
          ? ((weights[partner] && !malefic) ? 1 : pc === 'harmonious' ? 1 : pc === 'dynamic' ? 0.5 : -0.5)
          : (pc === 'challenging' ? -0.5 : (malefic && pc === 'dynamic') ? 0.5 : 1);
        const val = valueFor(voice(lead), verdict[voice(lead)].category, T) * pk;
        const sc = PARAN_WEIGHT * Math.max(w1, w2) * (T.angles[leadAng] || 0) * val * f;
        (sc > 0 ? best : care).push({ s: Math.abs(sc), why, line: 'paran' });
      }
    }
    // 2) Hard planets on the angles here.
    for (const [p, w] of Object.entries(HARD)) {
      const v = verdict[p]; if (!v) continue;
      if (weights[p] && (T.maleficDynamic > 0 || v.category === 'harmonious')) continue;
      // Oct 26 (Lima, healing): Uranus is a healing planet; its line is already scored
      // above as a theme planet, so it isn't also a hard-planet caution there.
      if (weights[p] && !MALEFIC.includes(p)) continue;
      if (v.category === 'harmonious') {
        for (const [ang, aw] of Object.entries(T.angles)) {
          if (T.icOnly && ang === 'IC' && !T.icOnly.includes(p)) continue;
          const c = closeness(p, ang, city, chart); if (!c.f) continue;
          best.push({ s: 0.5 * w * aw * c.f, why: `${NAME[p] || p} ${ANG[ang]} · ${c.label} (harmonious)`, line: p + ang });
        }
        continue;
      }
      const k = v.category === 'challenging' ? 1 : 0.5;
      for (const [ang, aw] of Object.entries(T.angles)) {
        const c = closeness(p, ang, city, chart); if (!c.f) continue;
        if (companion[p]) { if (c.f > 0.3) intense.add(`${NAME[p] || p} with ${companion[p]}`); continue; }
        if (T.pairMatters && p === 'Saturn' && ang === 'DSC') continue;
        // Oct 30 (Sarah, Graz): Saturn on an angle weighs double in healing: hard to rest under it.
        care.push({ s: k * w * aw * c.f * (T.label === 'Home' && p === 'Saturn' ? 2 : 1), why: `${NAME[p] || p} ${ANG[ang]} · ${c.label} (${v.category})`, line: p + ang, pa: p + '|' + ang });
      }
    }
    // 2d) Oct 26 (Sarah: Franca vs Rio, Havana for Mom): Chiron's lines are
    //     recognised in every report. Chiron on an angle brings old wounds to the
    //     surface there, whatever its Map Guide verdict: a caution, weighted by how
    //     much that angle matters to the report. Full within 2°, gone by 6°.
    if (CHIRONLINE) for (const [ang, aw] of Object.entries(T.angles)) {
      const o = angleOrb(chart.planets.Chiron.lon, city, ang);
      const f = o <= 2 ? 1 : Math.max(0, 1 - (o - 2) / 4); if (!f) continue;
      // Healing (Oct 26, as Neutrino reads it): Chiron on the IC is challenging but
      // supportive for healing, a small plus; on the other angles it is neutral there.
      // (Oct 30: the Healing exception, Chiron on the IC as a small plus, ended with the Home report: at home it is family wounds.)
      care.push({ s: CHIRON_W * aw * f, why: `Chiron ${ANG[ang]} · ${o.toFixed(1)}° from the ${ANG[ang]}: old wounds surface`, line: 'Chiron' + ang, pa: 'Chiron|' + ang });
    }
    // 1c) Love: Sun on DC with Moon angular
    if (T.pairMatters) {
      const sun = closeness('Sun', 'DSC', city, chart).f;
      const moon = Math.max(...['MC', 'IC', 'ASC', 'DSC'].map(a => { const o = angleOrb(chart.planets.Moon.lon, city, a); return orbTight(o); }));
      // Oct 31: the pairing is a plus only when the Moon isn't challenging in the chart (Sarah's 6th-house Moon).
      if (sun > 0.5 && moon > 0.5 && !(verdict.Moon && verdict.Moon.category === 'challenging')) best.push({ s: 0.4 * sun * moon, why: 'Sun on the DC with the Moon angular: both lights together', line: 'SunMoon' });
      else for (const pr of (chart.parans || [])) {
        const pair = [[pr.p1, pr.a1], [pr.p2, pr.a2]];
        if (!pair.some(([p, a]) => p === 'Sun' && a === 'DSC') || !pair.some(([p]) => p === 'Moon')) continue;
        const f = Math.max(0, 1 - Math.abs(city.lat - pr.lat) / 1.5); if (!f) continue;
        if (!(verdict.Moon && verdict.Moon.category === 'challenging')) best.push({ s: 0.4 * f, why: `Sun on the DC with the Moon on the ${ANG[pair.find(([p]) => p === 'Moon')[1]]} at ${Math.abs(pr.lat).toFixed(1)}°: both lights together`, line: 'SunMoon' });
      }
    }
    // 1e) Career: planets in the relocated 10th or within 8° of the MC
    if (T.companionCounts && city.cusps) {
      const W = 0.35;
      for (const p of Object.keys(chart.planets)) {
        if (!verdict[p]) continue;
        const in10 = houseOf(chart.planets[p].lon, city.cusps) === 10;
        const o = angleOrb(chart.planets[p].lon, city, 'MC');
        if (!in10 && o >= 8) continue;
        if (weights[p]) continue;
        if (HARD[p]) continue;   // Oct 26: hard planets on the MC are scored once, by the hard-planet check (Pluto at Hanzhong)
        if (CHIRONLINE && p === 'Chiron' && o < 6) continue;   // counted once, by 2d
        const v = p === 'Chiron' ? -1 : verdict[p].category === 'harmonious' ? 1 : verdict[p].category === 'dynamic' ? 0.6 : -1;
        const k = Math.max(in10 ? 0.6 : 0, o < 8 ? 1 - o / 8 : 0);
        (v > 0 ? best : care).push({ s: Math.abs(W * v * k), why: `${NAME[p] || p} ${in10 ? 'in the relocated 10th' : ''}${o < 8 ? (in10 ? ', ' : '') + o.toFixed(1) + '° from the MC' : ''} (${verdict[p].category})`, line: 'mc10' });
      }
    }
    // 1f) Healing: Pluto tight on an angle
    if (T.label === 'Home') for (const ang of ['IC', 'ASC', 'DSC', 'MC']) {
      const o = angleOrb(chart.planets.Pluto.lon, city, ang); if (o >= 3) continue;
      // Oct 28 (Sarah, Wuhan): half weight when Pluto is not hard in the chart (Map Guide score 0 or better).
      care.push({ s: (0.8 * (1 - o / 3) + 0.2) * ((A.planets.Pluto && A.planets.Pluto.score >= 0) ? 0.5 : 1), why: `Pluto ${o.toFixed(1)}° from the ${ANG[ang]}: intensity, not rest`, line: 'PlutoTight' });
    }
    // Oct 30 (Sarah, Yaoundé): only a Moon the Map Guide scores below zero makes the DC a caution.
    if (moonWeak && A.planets.Moon && A.planets.Moon.score < 0) {
      const o = angleOrb(chart.planets.Moon.lon, city, 'DSC');
      if (o < 8) care.push({ s: 0.5 * (1 - o / 8), why: `Moon ${o.toFixed(1)}° from the DC (${verdict.Moon.category}): emotional dependence in partnership`, line: 'MoonDSC' });
    }
    const coveredBySun = (p, ang) => {
      if (p === 'Sun' || !chart.planets.Sun) return false;
      // Oct 26 (Sarah, Franca: Mercury DC): a planet the Map Guide calls challenging
      // is never covered by the Sun beside it; its line counts in full.
      if (verdict[p] && verdict[p].category === 'challenging') return false;
      let d = n360(chart.planets[p].lon - chart.planets.Sun.lon); d = Math.min(d, 360 - d);
      return d <= 5 && angleOrb(chart.planets.Sun.lon, city, ang) < 8;
    };
    if (verdict.Saturn && verdict.Saturn.category !== 'harmonious') {
      const o = angleOrb(chart.planets.Saturn.lon, city, 'MC');
      const SO = TIGHT ? 5 : 8;   // Oct 25 (Mom: Toronto): tighter orb
      if (o < SO) care.push({ s: 0.6 * (1 - o / SO), why: `Saturn ${o.toFixed(1)}° from the MC (${verdict.Saturn.category}): burden on reputation`, line: 'SaturnMC', pa: 'Saturn|MC' });
    }
    // 2b) other challenging planets on key angles
    for (const p of Object.keys(chart.planets)) {
      if (weights[p] || HARD[p] || !verdict[p] || verdict[p].category !== 'challenging') continue;
      for (const ang of T.blockAt) {
        const c = closeness(p, ang, city, chart); if (!c.f) continue;
        if (coveredBySun(p, ang)) continue;
        // Oct 26: a challenging planet's line is felt close in: full within 2°, gone by 5°.
        { const o = angleOrb(chart.planets[p].lon, city, ang); c.f = o <= 2 ? 1 : Math.max(0, 1 - (o - 2) / 3); if (!c.f) continue; }
        care.push({ s: 0.25 * T.angles[ang] * c.f, why: `${NAME[p] || p} ${ANG[ang]} · ${c.label} (challenging)`, line: p + ang, pa: p + '|' + ang });
      }
    }
    // 2c) whole-chart check
    { const angs = { ASC: city.asc, DSC: city.asc + 180, MC: city.mc, IC: city.mc + 180 };
      for (const [p, v] of Object.entries(chart.planets)) {
        const q = A.planets[p] ? A.planets[p].score / 4 : null; if (q == null || q >= 0) continue;
        for (const [a, l] of Object.entries(angs)) {
          let o = angleOrb(v.lon, city, a); if (o >= 5) continue;   // Oct 26: felt close in (was 8°)
          // Oct 28 (Sarah: Cairo and Osaka are bad for love): a planet the Map Guide scores −4 or worse (Sarah's Mercury, −5) counts double.
          // Oct 28 (Sarah: same avoid places in every report): scaled by how much this angle matters to the report.
          if (coveredBySun(p, a)) continue;
          care.push({ s: 0.4 * Math.min(1, -q) * (A.planets[p].score <= -4 ? 2 : 1) * (0.4 + 0.6 * (T.angles[a] || 0)) * (o <= 2 ? 1 : 1 - (o - 2) / 3), why: `${NAME[p] || p} ${o.toFixed(1)}° from the ${ANG[a]} (Map Guide score ${A.planets[p].score})`, line: 'whole', pa: p + '|' + a });
        }
      } }
    // 3) Relocated chart
    if (city.cusps) {
      for (const [p, w] of Object.entries(weights)) {
        const v = verdict[p]; if (!v) continue;
        const h = houseOf(chart.planets[p].lon, city.cusps);
        if (T.houses.includes(h)) {
          const val = valueFor(voice(p), verdict[voice(p)].category, T) * w * 0.2 * ((T.houseWeight || {})[h] || 1);
          (val > 0 ? best : care).push({ s: Math.abs(val), why: `${NAME[p] || p} in relocated ${h}${h===1?'st':h===2?'nd':h===3?'rd':'th'} house (${v.category})`, reloc: true });
        }
      }
      for (const h of (T.rulerHouses || T.houses)) {
        const r = RULER[signOf(city.cusps[h - 1])], v = verdict[r]; if (!v) continue;
        const fused = !T.companionCounts && Object.values(companion).includes(r) ? 0.5 : 1;
        const val = valueFor(r, v.category, T) * 0.15 * fused * ((T.houseWeight || {})[h] || 1);
        (val > 0 ? best : care).push({ s: Math.abs(val), why: `relocated ${h}${h===1?'st':h===2?'nd':h===3?'rd':'th'} ruled by ${r} (${v.category})`, reloc: true });
      }
      for (const [h, w] of Object.entries(T.occupancy || {})) {
        let k = 0;
        for (const [p, v] of Object.entries(chart.planets)) {
          if (!verdict[p] || houseOf(v.lon, city.cusps) !== +h) continue;
          // Oct 26 (Mom: London, Laguna, married and divorced): Chiron inside the
          // relocated 7th is a wound in partnership, not an activation.
          if (p === 'Chiron' && CHIRONLINE && T.pairMatters && +h === 7) { care.push({ s: 0.2, why: 'Chiron inside the relocated 7th: partnership touches old wounds', reloc: true }); continue; }
          // Nov 1 (Sarah, Zagreb): a planet the chart makes challenging fills the house with friction, not comfort.
          if (verdict[p].category === 'challenging') { care.push({ s: w, why: `${NAME[p] || p} inside the relocated ${h}${h==1?'st':h==2?'nd':h==3?'rd':'th'} (challenging)`, reloc: true }); continue; }
          best.push({ s: w * Math.pow(0.5, k++), why: `${NAME[p] || p} inside the relocated ${h}${h==1?'st':h==2?'nd':h==3?'rd':'th'}`, line: 'house' });
        }
      }
      { const h0 = T.houses[0], r0 = RULER[signOf(city.cusps[h0 - 1])], v0 = verdict[r0];
        if (v0 && v0.category === 'challenging') {
          const angs = { ASC: city.asc, DSC: city.asc + 180, MC: city.mc, IC: city.mc + 180 };
          let best0 = 0, at = null;
          for (const [a, l] of Object.entries(angs)) { let o = angleOrb(chart.planets[r0].lon, city, a); const f = (o < 8 && !coveredBySun(r0, a)) ? 1 - o / 8 : 0; if (f > best0) { best0 = f; at = [a, o]; } }
          if (best0) { const i = care.findIndex(x => x.why === `relocated ${h0}th ruled by ${r0} (${v0.category})`); if (i >= 0) care.splice(i, 1); }
          if (best0) care.push({ s: 0.6 * best0, why: `${r0} rules the relocated ${h0}th and sits ${at[1].toFixed(1)}° from the ${ANG[at[0]]} (challenging)`, reloc: true, pa: r0 + '|' + at[0] });
        } }
      if (T.pairMatters && houseOf(chart.planets.Moon.lon, city.cusps) === 7 && angleOrb(chart.planets.Moon.lon, city, 'DSC') >= 5)
        best.push({ s: 0.3, why: 'Moon inside the relocated 7th: nurturing partnership', reloc: true });
      for (const [p, v] of Object.entries(chart.planets)) {
        if (!verdict[p] || verdict[p].category !== 'challenging') continue;
        if (houseOf(v.lon, city.cusps) === 1) care.push({ s: 0.4, why: `${NAME[p] || p} inside the relocated 1st (challenging)`, reloc: true });
      }
      if (verdict.Saturn && verdict.Saturn.category !== 'harmonious' && !T.pairMatters) {
        const o = angleOrb(chart.planets.Saturn.lon, city, 'ASC');
        if (o < 8) care.push({ s: 0.3 + 0.5 * (1 - o / 8), why: `Saturn rising, ${o.toFixed(1)}° from the AC (${verdict.Saturn.category}): heaviness, delays`, reloc: true });
      }
      if (T.pairMatters && verdict.Saturn && verdict.Saturn.category !== 'harmonious') {
        const hs = houseOf(chart.planets.Saturn.lon, city.cusps);
        if (hs === 1 && angleOrb(chart.planets.Saturn.lon, city, 'ASC') >= 8) {} else
        if ([1, 5, 8].includes(hs)) care.push({ s: (hs === 5 && T.pairMatters) ? 0.6 : 0.4, why: `Saturn inside the relocated ${hs === 1 ? '1st' : hs + 'th'} (${verdict.Saturn.category})`, reloc: true });
      }
      if (T.mcRulerMatch) {
        const natal10 = RULER[signOf(chart.natal.cusps[9])], here = RULER[signOf(city.mc)];
        if (natal10 === here) best.push({ s: 0.3, why: `${here} rules your natal 10th and the MC here (${signOf(city.mc)} MC)`, reloc: true });
      }
      for (const [p, w] of Object.entries(HARD)) {
        if (weights[p] && T.maleficDynamic > 0) continue;
        const v = verdict[p]; if (!v || v.category === 'harmonious' || companion[p]) continue;
        const h = houseOf(chart.planets[p].lon, city.cusps);
        if (T.pairMatters && p === 'Saturn' && h === 7) continue;
        if (h === T.houses[0] && (p === 'Saturn' || p === 'Mars')) { care.push({ s: (v.category === 'challenging' ? 0.8 : 0.6), why: `${NAME[p] || p} inside the relocated ${h}th, the heart of this report (${v.category})`, reloc: true }); continue; }
        if (T.pairMatters && p === 'Mars' && h === 5) continue;
        if (T.houses.includes(h)) care.push({ s: (v.category === 'challenging' ? 0.3 : 0.2) * w, why: `${NAME[p] || p} in relocated ${h}${h===1?'st':h===2?'nd':h===3?'rd':'th'} house (${v.category})`, reloc: true });
      }
    }
    // Oct 25 (Mom: Toronto): one planet on one angle is one caution. The same Saturn
    // on the MC was counted four ways (its line, burden on reputation, ruling the 7th,
    // whole-chart score); keep only the strongest of them.
    if (TIGHT) { const top = {}; for (const x of care) if (x.pa && (!top[x.pa] || x.s > top[x.pa].s)) top[x.pa] = x;
      for (let i = care.length - 1; i >= 0; i--) if (care[i].pa && top[care[i].pa] !== care[i]) care.splice(i, 1); }
    // Oct 28 (Sarah, Mom: Lima, Panama City, Raleigh are not bad for work and money):
    // in the career report Saturn or Chiron at the top of the chart is slow, earned
    // success, a light caution rather than a heavy one. Love and healing unchanged.
    if (T.companionCounts && SOFTMC) for (const x of care) if (x.pa === 'Saturn|MC' || x.pa === 'Chiron|MC') { x.s *= 0.4; x.why = x.why.replace(': burden on reputation', ': success comes slowly but holds').replace(': old wounds surface', ': old doubts to work through'); }
    const sum = a => a.reduce((t, x) => t + x.s, 0);
    best.sort((a, b) => b.s - a.s); care.sort((a, b) => b.s - a.s);
    const isHouse = x => x.reloc || x.line === 'house';
    const b = sum(best.filter(x => !isHouse(x))) + Math.min(0.6, sum(best.filter(isHouse))), c = sum(care);
    const linePlus = sum(best.filter(x => !x.reloc));
    const claim = b - c - 0.5 * sum(best.filter(x => x.line === 'paran')) + 0.5 * sum(care.filter(x => x.line === 'paran'));
    const leadItem = best.find(x => !x.reloc && x.line && x.line !== 'paran' && x.line !== 'SunMoon');
    const crossings = [...best.filter(x => x.line === 'paran').map(x => Object.assign({ effect: 'helps' }, x)),
                       ...care.filter(x => x.line === 'paran').map(x => Object.assign({ effect: 'caution' }, x)),
                       ...neutral.map(x => Object.assign({ effect: 'neutral' }, x))];
    // Oct 29 (Sarah: "take inspo from the map guide"; 90% of Mom's places to avoid were supportive):
    // the place's overall Map Guide score: each planet's Map Guide score, weighted by how close
    // its nearest line runs (full on the line, gone by 900 km). Like Neutrino's overall score.
    let overall = 0; if (city.dist) for (const p in city.dist) { const q = A.planets[p] ? A.planets[p].score : null; if (q == null) continue;
      const km = Math.min(...Object.values(city.dist[p])); overall += q * (p === 'NNode' ? 0.5 : 1) * Math.max(0, 1 - km / 900); }   // North Node: a point, half
    // Oct 30 (Sarah, Durban): crossings count too, half as much as a line.
    for (const pr of (chart.parans || [])) { const d = Math.abs(city.lat - pr.lat); if (d >= 1.5) continue;
      const q1 = A.planets[pr.p1] ? A.planets[pr.p1].score : 0, q2 = A.planets[pr.p2] ? A.planets[pr.p2].score : 0;
      overall += 0.5 * ((q1 + q2) / 2) * (1 - d / 1.5); }
    // Oct 30: the overall Map Guide score is part of every place's score (±0.3 at most).
    const ovAdj = Math.max(-0.3, Math.min(0.3, 0.03 * overall));
    return { name: city.n, region: city.r || '', country: city.c, lat: city.lat, lng: city.lng, pop: city.pop || 0, dest: !!city.dest, overall, notable: (city.pop || 0) >= (city.c === 'China' ? 1000000 : 300000) || !!city.dest || !('pop' in city), best, care, crossings, linePlus, claim, intense: [...intense],
             score: Math.round((b - c + ovAdj) * 100) / 100, plus: b, minus: c,
             lead: leadItem && leadItem.line, leadS: leadItem ? leadItem.s : 0 };
  });

  const km = (a, b) => { const r = Math.PI / 180, h = Math.sin((b.lat - a.lat) * r / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
  const pickDistinct = (list, n, sameLineOk) => {
    const picks = [];
    const pool = list.filter(r => {
      if (sameLineOk || !r.lead || process.env.NOPRUNE !== '0') return true;
      return !list.some(o => o !== r && o.lead === r.lead && km(o, r) < 600 && o.leadS > r.leadS && o.score > 0.6 * r.score);
    });
    const region = r => r.lng < -30 ? (r.lat > 15 ? 'N America' : 'S America')
      : r.lng > 110 && r.lat < -10 ? 'Oceania'
      : r.lat > 37 && r.lng < 45 ? 'Europe' : r.lng < 55 && r.lat < 35 ? 'Africa / Middle East' : 'Asia';
    // Oct 26 (Sarah): no per-region limit; the 450 km spacing is the only variety rule. REGIONCAP=1 restores it.
    const perRegion = {}, perBand = {};
    // Oct 30 (Sarah's healing: all seven on her Neptune–Uranus IC band): at most 3 places per line. Planets born
    // within 8° of each other share one band, since their lines run together.
    const bandOf = r => { const m = r.lead && r.lead.match(/^(.+?)(MC|IC|ASC|DSC)$/); if (!m || !chart.planets[m[1]]) return r.lead || '';
      const lon = chart.planets[m[1]].lon; const grp = Object.keys(chart.planets).filter(q => { const d = Math.abs(n360(chart.planets[q].lon - lon)); return Math.min(d, 360 - d) <= 8; }).sort();
      return grp.join('+') + m[2]; };
    for (const r of pool) {
      if (picks.length >= n) break;
      if (picks.some(p => km(p, r) < 450)) continue;
      if (!sameLineOk && LINECAP && (perBand[bandOf(r)] || 0) >= 3) continue;
      if (!sameLineOk) perBand[bandOf(r)] = (perBand[bandOf(r)] || 0) + 1;
      const g = region(r); if (process.env.REGIONCAP === '1' && !sameLineOk && (perRegion[g] || 0) >= 3 && r.score < 0.75 * (pool[0] ? pool[0].score : 0)) continue;
      perRegion[g] = (perRegion[g] || 0) + 1; r.part = g;
      picks.push(r);
    }
    return picks;
  };
  // Nov 8 (speed only, same result): look cities up by name from a table built once, not by searching
  // the whole city list again for every city. Like .find(), it returns the first city with that name.
  const byName = new Map(); for (const x of chart.cities) if (!byName.has(x.n)) byName.set(x.n, x);
  const blocked = r => {
    const city = byName.get(r.name);
    return ['Mars', 'Saturn'].some(p => verdict[p] && verdict[p].category !== 'harmonious' &&
      T.blockAt.some(a => !(T.pairMatters && p === 'Saturn' && a === 'DSC') && closeness(p, a, city, chart).f >= 0.85));
  };
  results.forEach(r => { r.blocked = blocked(r); });
  const byScore = results.filter(r => r.linePlus >= 0.4 && !r.blocked && (!allowed || allowed(r.name + '|' + r.lat + '|' + r.lng))).sort((a, b) => b.score - a.score);
  const eligible = r => !r.blocked && (!allowed || allowed(r.name + '|' + r.lat + '|' + r.lng));
  const cand = byScore.filter(r => r.notable);
  const N = +(process.env.N || 7);
  const picked = pickDistinct(cand, N, false).sort((a, b) => b.score - a.score);
  // Oct 30 (Sarah: The Hague → Amsterdam, Juiz de Fora → Rio): when a much better-known city within
  // 200 km scores at least 85% as well, on the same lines, show that city instead.
  for (let i = 0; i < picked.length; i++) { const p = picked[i];
    const alt = results.filter(r => r !== p && !picked.includes(r) && eligible(r) && r.linePlus >= 0.4 && (r.pop || 0) >= Math.max(500000, 1.5 * (p.pop || 0)) && km(p, r) < 200 && r.country === p.country && r.score >= 0.85 * p.score)
      .sort((a, b) => b.score - a.score)[0];
    if (alt) picked[i] = alt; }
  const best = picked.map(p => {
    const nb = results.filter(r => r !== p && r.notable && eligible(r) && r.linePlus >= 0.4 && km(p, r) < 300 && r.score >= 0.85 * p.score)
      .sort((a, b) => b.score - a.score);
    return Object.assign(p, { nearby: nb.slice(0, 3).map(r => r.name), nearbyScores: nb.slice(0, 3).map(r => +r.score.toFixed(2)) });
  });
  // Oct 28 (Sarah: Lima, Panama City, Raleigh are not bad for Mom's work and money):
  // in career, Saturn or Chiron on the MC is slow, earned success, so a place with
  // either within 3° of the MC is not shown as a caution place.
  // Oct 28 (Sarah: "you need to show places that need to be avoided"): a caution place
  // must be somewhere people would actually go: 1M+ people, or a known destination.
  const famous = r => (r.pop || 0) >= 1000000 || r.dest;
  const earned = r => SOFTMC && T.companionCounts && r.care.some(x => (x.pa === 'Saturn|MC' || x.pa === 'Chiron|MC') && /(\d+\.\d)° from the MC/.test(x.why) && +x.why.match(/(\d+\.\d)° from the MC/)[1] <= 3);
  // Oct 28: caution places are chosen by what is really there, lines and crossings
  // (and a ruler sitting on an angle), not by house placements alone.
  // Oct 28 (Sarah: "see if other crossings are there to outweigh the negative"): a place to avoid
  // must have its hard lines and crossings clearly outweigh the good ones there (hardScore),
  // and its whole balance for this report must be negative. Tested against Sarah's calls:
  // full-balance ranking brought back house double counts (Meerut), so lines and crossings decide.
  // Every place Sarah called bad has Saturn or Chiron in it (a line or a crossing); St. Petersburg,
  // Wuhan and Dublin, which she called fine, don't, or have it outweighed. Needed, not enough on its own.
  // (Saturn or Chiron on a line here, or in a crossing with another hard planet: St. Petersburg's
  // Mars × Saturn has Sarah's easy Mars, Cairo's Mercury × Chiron has two hard planets.)
  const satChi = r => r.care.filter(lineOnly).some(x => x.s >= 0.1 && (x.line !== 'paran' ? /^(Saturn|Chiron)\b/.test(x.why)
    : /Saturn|Chiron/.test(x.why) && /two difficult planets| weigh on it|Chiron on the MC|old wounds/.test(x.why)));
  // Oct 28 (Sarah, Mom's Mexico City: "only 1 paran"): one crossing alone never makes a place to avoid.
  // It needs a hard planet close to an angle here, or at least two hard crossings.
  const solid = r => { const c = r.care.filter(lineOnly).filter(x => x.s >= 0.1);
    return c.some(x => x.line !== 'paran' && /[\d.]+° from/.test(x.why)) || c.filter(x => x.line === 'paran').length >= 2; };
  const careCands = results.filter(r => !best.includes(r) && famous(r) && hardScore(r) > 0.5 && r.score <= -0.25 && satChi(r) && solid(r) && r.overall <= -0.5 && !earned(r));   // and the Map Guide must call the place negative overall
  const careList = pickDistinct(careCands.filter(r => !careAllowed || careAllowed(r.name + '|' + r.lat + '|' + r.lng)).sort((a, b) => hardScore(b) - hardScore(a)), NCARE, true);
  // Oct 26 (naming fix): a pick that sits in a bigger city's metro area is shown
  // under that city's name (Callao -> Lima, Betim -> Belo Horizonte), with the
  // exact spot kept as a subtitle. Scoring is unchanged: the place is still the
  // one scored on its own chart.
  const metro = p => {
    const big = chart.cities.filter(o => (o.pop || 0) >= 300000 && (((o.pop || 0) > (p.pop || 0) && km(p, o) < 20) || ((o.pop || 0) >= 2 * (p.pop || 0) && km(p, o) < 40)))
      .sort((x, y) => y.pop - x.pop)[0];
    const SHORT = { 'Acapulco de Juárez': 'Acapulco', 'Victoria de Durango': 'Durango', 'Naberezhnyye Chelny': 'Naberezhnye Chelny', 'Santiago de Querétaro': 'Querétaro', 'León de los Aldama': 'León' };
    p.display = big ? big.n : p.name; p.spot = big ? p.name : '';
    p.display = SHORT[p.display] || p.display;
  };
  best.forEach(metro); careList.forEach(metro);

  return { theme: T.label, verdict, rulerNotes, weights: W0, angles: T.angles, best, care: careList, careCands, results };
}

function rankAll(chart) {
  const raw = {}; for (const t of Object.keys(THEMES)) raw[t] = rank(chart, t);
  const home = {};
  for (const t in raw) for (const r of raw[t].results) {
    const rel = r.score;
    const key = r.name + '|' + r.lat + '|' + r.lng;
    if (!home[key] || rel > home[key].rel) home[key] = { t, rel };
  }
  const out = {};
  // (tried Oct 28 and dropped: it moved Cairo out of Sarah's love cautions and lost Mom's Lima.
  // A place can be hard for two areas of life, so caution places may repeat across reports.)
  // Oct 28: a city is a place to avoid in one report only. Places are handed out hardest first:
  // each goes to the report where it is worst, if that report still has room (3) and nothing
  // within 450 km, so a hard place is never lost (Makassar, Mom's Lima).
  const kmAll = (a, b) => { const r = Math.PI / 180, h = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
  const all = [];
  for (const t in raw) for (const r of raw[t].careCands) all.push({ t, r, h: hardScore(r), key: r.name + '|' + r.lat + '|' + r.lng });
  all.sort((x, y) => y.h - x.h);
  // Oct 31 (Sarah, Cairo: −0.56 love vs −0.58 career): a place nearly as hard for two reports (within 10%)
  // goes to the one with fewer places to avoid so far, so a report isn't left short.
  const byKey = {}; for (const c of all) (byKey[c.key] = byKey[c.key] || []).push(c);
  const used = new Set(), chosen = {}; for (const t in raw) chosen[t] = [];
  for (const c of all) {
    if (used.has(c.key)) continue;
    { const alts = byKey[c.key].filter(o => o !== c && o.h >= 0.9 * c.h && chosen[o.t].length < chosen[c.t].length && !chosen[o.t].some(q => kmAll(q.r, o.r) < 450));
      if (alts.length && chosen[alts[0].t].length < NCARE) { const o = alts[0]; if (!Object.values(chosen).flat().some(q => kmAll(q.r, o.r) < 40)) { used.add(o.key); chosen[o.t].push(o); continue; } } }
    if (chosen[c.t].length >= NCARE || chosen[c.t].some(o => kmAll(o.r, c.r) < 450)) continue;
    if (Object.values(chosen).flat().some(o => kmAll(o.r, c.r) < 40)) continue;   // same metro (Giza shows as Cairo)
    used.add(c.key); chosen[c.t].push(c);
  }
  for (const t in raw) { const keys = new Set(chosen[t].map(c => c.key)); out[t] = rank(chart, t, n => !home[n] || home[n].t === t, k => keys.has(k)); }
  const LABEL = { love: 'love', career: 'career', home: 'home' };
  for (const t in out) for (const p of out[t].best) {
    const also = Object.keys(raw).filter(u => u !== t).filter(u => {
      const r = raw[u].results.find(x => x.name === p.name && x.lat === p.lat && x.lng === p.lng); return r && r.score >= 0.5 && r.score >= 0.5 * p.score;
    });
    p.alsoGoodFor = also.map(u => LABEL[u]);
    p.tagLine = also.length ? 'Also good for ' + also.map(u => LABEL[u]).join(' and ') : '';
  }
  return out;
}
module.exports = { rank, rankAll, THEMES, natalPlanets, E };

if (require.main === module) {
  const chart = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const all = rankAll(chart);
  if (process.env.JSONOUT) {
    const slim = {};
    for (const t in all) slim[t] = { verdict: all[t].verdict, rulerNotes: all[t].rulerNotes,
      best: all[t].best.map(p => ({ name: p.name, display: p.display, spot: p.spot, region: p.region, country: p.country, lat: p.lat, lng: p.lng, pop: p.pop, score: p.score, best: p.best.slice(0, 6), care: p.care.slice(0, 4), nearby: p.nearby, intense: p.intense, tagLine: p.tagLine })),
      care: all[t].care.map(p => ({ name: p.name, display: p.display, spot: p.spot, country: p.country, minus: p.minus, care: p.care.slice(0, 4) })) };
    fs.writeFileSync(process.env.JSONOUT, JSON.stringify(slim, null, 1));
  }
  for (const t of (process.argv[3] ? [process.argv[3]] : Object.keys(THEMES))) {
    const r = all[t];
    console.log(`\n══ ${r.theme.toUpperCase()} ══  (${r.rulerNotes.join('; ')})`);
    console.log('Planet verdicts:', Object.entries(r.verdict).filter(([n]) => THEMES[t].planets[n] || r.rulerNotes.some(x => x.startsWith(n)))
      .map(([n, v]) => `${n} ${v.category}`).join(', '));
    r.best.forEach((p, i) => console.log(`${i + 1}. ${p.display || p.name}${p.spot ? ' (' + p.spot + ')' : ''}, ${p.country}  [${p.score}]${p.intense.length ? ' ✦ intense: ' + p.intense.join(', ') : ''}  ${p.best.slice(0, 3).map(x => x.why).join(' | ')}${p.care.length ? '  ⚠ ' + p.care.slice(0, 2).map(x => x.why).join(' | ') : ''}${p.nearby.length ? '  also: ' + p.nearby.join(', ') : ''}`));
    console.log('Care:'); r.care.forEach(p => console.log(`   ${p.display || p.name}${p.spot ? ' (' + p.spot + ')' : ''}, ${p.country}  [-${Math.round(p.minus * 100) / 100}]  ${p.care.slice(0, 3).map(x => x.why).join(' | ')}`));
  }
}
