// Turns the engine's ranking into the words of a report.
//   node report.js <chart_world.json> <theme> "<Name>" "<birth line>" <birthLat> <birthLng> "<Birthplace>"  > report.json
// Output: everything the report page shows, for one theme: map at a glance,
// planets, the 7 places with their cards, approach with care, where you began,
// and how it was worked out. All text comes from the templates below, so every
// report reads the same way and nothing is written by hand.
// (Site copy: loads ./rank.cjs; otherwise the same as reports-engine/report.js.)
const fs = require('fs');
const R = require('./rank.cjs');

// ── Words ──────────────────────────────────────────────────────────────
const NAME = { NNode: 'North Node' };
const SHORTN = { 'Acapulco de Juárez': 'Acapulco', 'Victoria de Durango': 'Durango', 'León de los Aldama': 'León', 'Santiago de Querétaro': 'Querétaro', 'Naberezhnyye Chelny': 'Naberezhnye Chelny' };
const nm = p => NAME[p] || p;
const ANGP = { MC: 'at the top of your chart', IC: 'at the base of your chart', AC: 'on your Ascendant', DC: 'on your Descendant' };
const ANGWORD = { MC: 'the top of your chart (MC)', IC: 'the base of your chart (IC)', AC: 'your Ascendant', DC: 'your Descendant' };
const ANGSHORT = { MC: 'MC', IC: 'IC', AC: 'Ascendant', DC: 'Descendant' };
const THEMEWORD = { love: 'love', career: 'career', home: 'home' };

// What a planet brings on an angle, per report. Keys: planet + angle. Only the
// pairings a report actually rewards are written out; anything else falls back
// to the planet's general meaning.
const SUBJ = { Sun: 'Your Sun', Moon: 'Your Moon', NNode: 'Your North Node', 'North Node': 'Your North Node' };
const subj = p => SUBJ[p] || p;
const near = o => o < 1 ? 'almost exactly on' : o < 3 ? 'close to' : 'within reach of';
// What a planet brings on an angle, per report (two or three wordings each, so
// places on the same line don't all read alike).
const LEAD = {
  love: {
    VenusDC: ['you attract partners easily here, and love feels warm and generous.', 'romance comes easily, and people are drawn to you.', 'affection flows both ways; this is where you are most easily loved.'],
    SunDC: ['a partner who becomes central to your life, and a relationship you are proud to be seen in.', 'you meet people who shine, and partnership puts you in the spotlight.', 'love here is warm, visible and committed.'],
    MoonDC: ['tender, caring partnership that feels like home.', 'emotional closeness comes naturally with the people you meet here.'],
    JupiterDC: ['partners who widen your world, and love that feels lucky.', 'generous, open-hearted partnership.'],
    NNodeDC: ['fated meetings, the people you are meant to find.', 'relationships here feel like they were meant to happen.'],
    VenusAC: ['you are at your most magnetic, and people warm to you quickly.'],
    VenusIC: ['love that is private and rooted in home and family.'],
    VenusMC: ['you are seen as charming, and love can come through your public life.'],
    JupiterAC: ['confidence and good fortune that make you easy to love.'],
  },
  career: {
    SunMC: ['you are seen and credited for your work.', 'leadership and visibility come naturally.'],
    JupiterMC: ['recognition, growth and money come easily.', 'opportunities find you, and success comes with goodwill.', 'generous employers, promotions and money that grows.'],
    MarsMC: ['drive, competitiveness and the energy to build something.', 'ambition and the courage to lead.'],
    UranusMC: ['independent, unconventional work and new directions.', 'work you shape yourself, often in new fields.'],
    SaturnMC: ['authority that is earned slowly and lasts.'],
    VenusMC: ['work that runs on charm, taste and good relationships.'],
    MoonMC: ['a public role that feels natural, and people who trust you.', 'you are liked and trusted in public.'],
    MercuryMC: ['ideas, writing and deals bring you forward.'],
    NeptuneMC: ['creative or spiritual work, though the path can be hazy.'],
    SunIC: ['a career built from home or family.'],
    JupiterIC: ['wealth that grows through property, home or family.'],
  },
  home: {
    MoonIC: ['a place that feels like home, where you can rest.', 'you feel safe and settled here.'],
    VenusIC: ['a beautiful, easy home life.', 'comfort, beauty and calm at home.'],
    JupiterIC: ['a generous, happy home; property and family do well.', 'room to grow roots.'],
    NeptuneIC: ['a peaceful, dreamy home; rest and intuition.', 'a quiet place where you let go.'],
    SunIC: ['you feel most yourself at home.', 'family and roots come to the fore.'],
    NNodeIC: ['putting down roots feels meant to be.'],
    MarsIC: ['an active, energised home life.'],
    MoonAC: ['you feel at ease in yourself here.'],
    VenusAC: ['you feel graceful and welcome here.'],
    JupiterAC: ['an optimistic, open place to settle.'],
  }
};
const HOUSEWORD = { 4: 'your relocated 4th house, the house of home', 7: 'your relocated 7th house, the house of partnership', 5: 'your relocated 5th house, the house of romance', 10: 'your relocated 10th house, the house of career', 2: 'your relocated 2nd house, the house of money', 12: 'your relocated 12th house, the house of rest and retreat', 9: 'your relocated 9th house, the house of meaning and travel', 1: 'your relocated 1st house' };
const GENERAL = {
  Sun: 'visibility and confidence', Moon: 'emotional ease', Mercury: 'ideas and conversation', Venus: 'charm and ease',
  Mars: 'drive and passion', Jupiter: 'luck and growth', Saturn: 'structure and effort', Uranus: 'freedom and change',
  Neptune: 'dreams and intuition', Pluto: 'intensity and transformation', Chiron: 'old wounds and healing', NNode: 'a sense of direction'
};
const TAG = {
  love: { Venus: 'Romance', Sun: 'Partner in the spotlight', NNode: 'Fated meeting', Moon: 'Caring and close', Jupiter: 'Lucky in love', SunMoon: 'Both lights together' },
  career: { Jupiter: 'Recognition', Sun: 'In the spotlight', Mars: 'Drive and independence', Uranus: 'Drive and independence', Moon: 'Recognition', Venus: 'Charm at work', Saturn: 'Lasting authority', Mercury: 'Ideas and deals' },
  home: { Moon: 'Feels like home', Venus: 'Beautiful home life', Jupiter: 'Room to grow roots', Neptune: 'Peace and rest', Sun: 'Most yourself', NNode: 'Roots that fit', Mars: 'Energy at home' }
};
// What a difficult planet does near an angle, for the caution sentence.
const HARD = {
  Saturn: 'Saturn makes things slow and heavy',
  Chiron: 'Chiron brings old wounds to the surface',
  Pluto: 'Pluto adds intensity and power struggles',
  Mars: 'Mars brings friction',
  Uranus: 'Uranus brings sudden change',
  Mercury: 'Mercury, which is challenging in your chart, brings misunderstandings',
};

// ── Parsing the engine's notes into structured facts ───────────────────
function parse(x) {
  const w = x.why; let m;
  if ((m = w.match(/^Paran: (.+?) (MC|IC|AC|DC) with (.+?) (MC|IC|AC|DC)(?: \(([\d.]+)°([NS])\))?/)))
    return { kind: 'paran', p1: m[1], a1: m[2], p2: m[3], a2: m[4], lat: m[5] ? (+m[5]) * (m[6] === 'S' ? -1 : 1) : null, s: x.s, why: w };
  if ((m = w.match(/^(.+?) (MC|IC|AC|DC) · ([\d.]+)° from/))) return { kind: 'line', p: m[1], ang: m[2], orb: +m[3], s: x.s, why: w };
  if ((m = w.match(/^(.+?) in the relocated 10th(?:, ([\d.]+)° from the MC)?/))) return m[2] ? { kind: 'line', p: m[1], ang: 'MC', orb: +m[2], s: x.s, why: w, in10: true } : { kind: 'house', p: m[1], h: 10, s: x.s, why: w }; // Oct 28: no distance given = house only, not a line
  if ((m = w.match(/^(.+?) ([\d.]+)° from the MC \(/))) return { kind: 'line', p: m[1], ang: 'MC', orb: +m[2], s: x.s, why: w };
  if ((m = w.match(/^(\w+) rules the relocated (\d+)th and sits ([\d.]+)° from the (MC|IC|AC|DC)/))) return { kind: 'near', p: m[1], ang: m[4], orb: +m[3], s: x.s, why: w, rules: +m[2] };
  if ((m = w.match(/^(?:Saturn rising, )?(.+?)? ?([\d.]+)° from the (MC|IC|AC|DC)/))) return { kind: 'near', p: m[1] || 'Saturn', ang: m[3], orb: +m[2], s: x.s, why: w };
  if (/rules your natal 10th and the MC here/.test(w)) return { kind: 'ruler', s: x.s, why: w };
  if (/both lights together/.test(w)) return { kind: 'union', s: x.s, why: w };
  if ((m = w.match(/^(.+?) (?:inside the|in) relocated (\d+)/)) || (m = w.match(/^(.+?) inside the relocated (\d+)/))) return { kind: 'house', p: m[1], h: +m[2], s: x.s, why: w };
  return { kind: 'other', s: x.s, why: w };
}
const deg = o => o < 0.5 ? 'almost exactly on' : o < 2 ? `${o.toFixed(1)}° from` : `${o.toFixed(1)}° from`;

// ── A place card ───────────────────────────────────────────────────────
function card(p, theme, rank) {
  const best = p.best.map(parse), care = p.care.map(parse);
  const lines = best.filter(b => b.kind === 'line' && b.s >= 0.1).sort((a, b) => b.s - a.s);
  const helps = best.filter(b => b.kind === 'paran' && b.s >= 0.08).sort((a, b) => b.s - a.s);
  const union = best.find(b => b.kind === 'union');
  const ruler = best.find(b => b.kind === 'ruler');
  const cautions = care.filter(c => c.s >= 0.15).sort((a, b) => b.s - a.s);
  const sentences = [];
  const K = p => p.replace('North Node', 'NNode');
  // Lead: the strongest line, unless another strong line is much tighter.
  let lead = lines[0];
  for (const l of lines.slice(1)) if (lead && l.s >= 0.5 * lead.s && l.orb < lead.orb - 1.5) lead = l;
  let leadPlanet = lead ? lead.p : (helps[0] ? helps[0].p1 : null);
  if (lead) {
    const opts = LEAD[theme][K(lead.p) + lead.ang];
    const meaning = opts ? opts[(rank + 1) % opts.length] : `${GENERAL[K(lead.p)] || 'its themes'} come to the fore.`;
    sentences.push(`${subj(lead.p)} is ${ANGP[lead.ang]} here (${lead.orb < 0.5 ? 'almost exactly' : lead.orb.toFixed(1) + '° away'}): ${meaning}`);
    const second = lines.find(l => l !== lead && l.p !== lead.p);
    if (second) {
      const opts2 = LEAD[theme][K(second.p) + second.ang];
      const what = opts2 ? opts2[rank % opts2.length].replace(/\.$/, '') : GENERAL[K(second.p)];
      sentences.push(`${subj(second.p)} is ${ANGP[second.ang]} too (${second.orb.toFixed(1)}°), adding ${GENERAL[K(second.p)]}.`);
    }
    const hs = best.find(b => b.kind === 'house' && K(b.p) === K(lead.p) && HOUSEWORD[b.h] && R.THEMES[theme].houses.includes(b.h));
    if (hs) sentences.push(`${subj(lead.p)} also falls inside ${HOUSEWORD[hs.h]}.`);
  } else if (helps[0]) {
    const h = helps[0];
    sentences.push(`No planet sits right on an angle here, but on this latitude ${nm(h.p1)} is on ${ANGWORD[h.a1]} at the same moment ${nm(h.p2)} is on ${ANGWORD[h.a2]}: a crossing that brings ${GENERAL[K(h.p1)]} and ${GENERAL[K(h.p2)]}.`);
  }
  if (union) sentences.push('Both your Sun and Moon are on angles here at once, a classic sign of a lasting union.');
  if (ruler && theme === 'career') sentences.push('The planet that runs your career at birth also runs the top of your chart here.');
  const h = helps[0];
  if (lead && h) sentences.push(`On this latitude your ${nm(h.p1)} on the ${ANGSHORT[h.a1]} crosses ${nm(h.p2)} on the ${ANGSHORT[h.a2]}, adding ${GENERAL[K(h.p2)] === GENERAL[K(lead.p)] ? GENERAL[K(h.p1)] : GENERAL[K(h.p2)]}.`);
  // Caution: the biggest one, in plain words.
  const c0 = cautions[0];
  if (c0) {
    const cp = c0.kind === 'paran' ? [c0.p1, c0.p2].find(q => HARD[q]) : c0.p;
    if (cp && HARD[cp]) sentences.push(`${HARD[cp]}${c0.kind === 'paran' ? ' on this latitude' : ' here'}, so ${theme === 'love' ? 'relationships take patience' : theme === 'career' ? 'progress takes patience' : 'it is not always restful'}.`);
  }
  // Love: love that may not last (Saturn or Chiron on the Descendant or in the 7th).
  let mayNotLast = false;
  if (theme === 'love') {
    mayNotLast = care.some(c => (c.p === 'Saturn' || c.p === 'Chiron') && (c.ang === 'DC' || c.h === 7) && c.s >= 0.1) ||
      // Oct 31 (Sarah, New York): only a crossing the engine calls hard counts (Saturn × Pluto isn't hard for her).
      care.some(c => c.kind === 'paran' && [c.p1, c.p2].some(q => q === 'Saturn' || q === 'Chiron') && (c.a1 === 'DC' || c.a2 === 'DC') && c.s >= 0.1 && /difficult|weigh|challenging|wounds|burden/.test(c.why)) ||
      care.some(c => /Chiron inside the relocated 7th/.test(c.why));
    if (mayNotLast) sentences.push('Love finds you here, but it may not last without real work: Saturn or Chiron sits on your partnership angle too.');
  }
  const tagKey = union && theme === 'love' && !lead ? 'SunMoon' : K(leadPlanet || lead && lead.p || '');
  let tag = rank === 1 ? 'Your strongest' : (TAG[theme][tagKey] || 'A good fit');
  if (rank !== 1 && lead && lead.orb < 1) tag = `${nm(lead.p)} on the line`;
  if (rank !== 1 && mayNotLast) tag = 'Love with lessons';
  // Chips: lines within reach, and crossings.
  const chips = lines.slice(0, 3).map(l => ({ planet: l.p.replace('North Node', 'NNode'), label: `${nm(l.p)} ${l.orb.toFixed(1)}° from ${l.ang}` }));
  const parans = [...helps.slice(0, 2).map(x => ({ p1: x.p1.replace('North Node', 'NNode'), p2: x.p2.replace('North Node', 'NNode'), label: `${nm(x.p1)} ${x.a1} × ${nm(x.p2)} ${x.a2}${x.lat != null ? ' · ' + Math.abs(x.lat).toFixed(1) + '°' + (x.lat >= 0 ? 'N' : 'S') : ''}`, effect: 'helps' })),
                  ...care.filter(c => c.kind === 'paran' && c.s >= 0.1).slice(0, 2).map(x => ({ p1: x.p1.replace('North Node', 'NNode'), p2: x.p2.replace('North Node', 'NNode'), label: `${nm(x.p1)} ${x.a1} × ${nm(x.p2)} ${x.a2}${x.lat != null ? ' · ' + Math.abs(x.lat).toFixed(1) + '°' + (x.lat >= 0 ? 'N' : 'S') : ''}`, effect: 'caution' }))];
  return { rank, city: p.display || p.name, spot: p.spot || '', region: p.region, country: p.country, lat: p.lat, lng: p.lng, score: p.score,
    tag, tagLine: p.tagLine || '', mayNotLast, lines: chips, parans, text: sentences.join(' '), nearby: (p.nearby || []).map(n => SHORTN[n] || n).filter(n => n !== (p.display || p.name) && n !== p.spot).slice(0, 3) };
}

let CARE_I = 0;
// ── An "approach with care" card ───────────────────────────────────────
function careCard(p, theme) {
  const care = p.care.map(parse).sort((a, b) => b.s - a.s);
  const tops = []; const seen = new Set();
  for (const c of care) {
    const q = c.kind === 'paran' ? [c.p1, c.p2].find(x => HARD[x]) : c.p;
    if (!q || seen.has(q) || !HARD[q]) continue; seen.add(q); tops.push({ q, c }); if (tops.length === 2) break;
  }
  const where = c => c.kind === 'paran' ? 'on this latitude' : c.kind === 'house' ? `inside ${HOUSEWORD[c.h] || 'your relocated ' + c.h + 'th house'}` : c.ang ? `${ANGP[c.ang]} here (${c.orb.toFixed(1)}°)` : 'here';
  const area = { love: 'relationships', career: 'work and recognition', home: 'home life' }[theme];
  const s = tops.map(({ q, c }, i) => i === 0 ? `${HARD[q]} ${where(c)}.` : `${HARD[q].replace(/^\w+(, which is challenging in your chart,)? /, `${q} also `)} ${where(c)}.`);
  // Oct 28 (Sarah: "you need to show places that need to be avoided"): say it plainly.
  const AV = { love: ['Best avoided for love.', 'Not where you want to look for love.', 'A hard place for relationships: best avoided.'],
               career: ['Best avoided for work and money.', 'Not where you want to build a career.', 'A hard place for work and recognition: best avoided.'],
               home: ['Best avoided as a place to live.', 'Not where you want to put down roots.', 'A hard place to feel at home: best avoided.'] }[theme];
  s.push(AV[(CARE_I++) % 3]);
  const lines = care.filter(c => c.kind === 'line' || c.kind === 'near').slice(0, 2).map(c => ({ planet: c.p, label: `${nm(c.p)} ${c.orb.toFixed(1)}° from ${c.ang}` }));
  const parans = care.filter(c => c.kind === 'paran').slice(0, 1).map(x => ({ p1: x.p1, p2: x.p2, label: `${nm(x.p1)} ${x.a1} × ${nm(x.p2)} ${x.a2}${x.lat != null ? ' · ' + Math.abs(x.lat).toFixed(1) + '°' + (x.lat >= 0 ? 'N' : 'S') : ''}`, effect: 'caution' }));
  return { city: p.display || p.name, spot: p.spot || '', country: p.country, lat: p.lat, lng: p.lng, lines, parans, text: s.join(' ') };
}


// ── Your top lines ─────────────────────────────────────────────────────
function topLines(r, cards, theme) {
  const AN = { MC: 'MC', IC: 'IC', ASC: 'AC', DSC: 'DC' };
  const V = { harmonious: 1, dynamic: 0.6 };
  const rows = [];
  for (const [p, w] of Object.entries(r.weights || {})) { const v = r.verdict[p] && V[r.verdict[p].category]; if (!w || !v) continue;
    for (const [a, aw] of Object.entries(r.angles || {})) rows.push({ p, a: AN[a], s: w * aw * v }); }
  rows.sort((x, y) => y.s - x.s);
  const top = rows.slice(0, 4);
  const where = l => cards.filter(c => c.lines.some(x => x.planet.replace('NNode', 'North Node') === nm(l.p) || x.planet === l.p) && c.lines.some(x => new RegExp(' from ' + l.a + '$').test(x.label))).map(c => c.city);
  const lead = top[0], lw = lead ? where(lead) : [];
  const word = { love: 'love', career: 'career and money', home: 'home' }[theme];
  const text = lead ? `${listWords(top.slice(0, 3).map(l => `${nm(l.p)} on the ${ANGSHORT[l.a]}`))} are the lines that matter most for ${word} in your chart.` +
    (lw.length ? ` ${listWords(lw.slice(0, 3))} ${lw.length > 1 ? 'sit' : 'sits'} on your strongest, ${nm(lead.p)} on the ${ANGSHORT[lead.a]}.` : '') : '';
  return { title: `Your top lines for ${word}`, chips: top.map(l => `${nm(l.p)} on the ${ANGSHORT[l.a]}`), text };
}

// ── Map at a glance ────────────────────────────────────────────────────
const regionOf = (lat, lng) => lng < -30 ? (lat > 15 ? 'North America' : lat > 5 ? 'Central America' : 'South America')
  : lng > 110 && lat < -10 ? 'Australia and the Pacific' : lat > 37 && lng < 45 ? 'Europe' : lng < 55 && lat < 35 ? (lng > 33 ? 'the Middle East' : 'Africa') : lng < 75 && lat > 40 ? 'Russia and Central Asia' : lat > 45 ? 'Russia and Central Asia' : 'Asia';
const THE = c => ['United States', 'United Kingdom', 'Netherlands', 'Philippines', 'United Arab Emirates', 'Czech Republic', 'Dominican Republic'].includes(c) ? 'the ' + c : c;
const listWords = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
function glance(cards, careCards, theme) {
  // Zone: the lines (planet + angle) that run through the most places.
  const count = {};
  for (const c of cards) for (const l of c.lines) { const m = l.label.match(/ ([\d.]+)° from (MC|IC|AC|DC)$/); if (!m || +m[1] > 5) continue; const k = l.planet + '|' + m[2]; (count[k] = count[k] || new Set()).add(c); }
  const keys = Object.entries(count).map(([k, v]) => [k, [...v]]).sort((a, b) => b[1].length - a[1].length).filter(([, v], i) => i === 0 || v.length >= 3).slice(0, 2);
  const lineWords = keys.map(([k]) => { const [p, a] = k.split('|'); return `${subj(p).replace(/^Your /, 'your ')} ${ANGP[a]}`; });
  const zoneCards = [...new Set(keys.flatMap(([, v]) => v))];
  const countries = [...new Set(zoneCards.map(c => c.country))];
  const regions = [...new Set(cards.map(c => regionOf(c.lat, c.lng)))];
  const zoneTitle = countries.length <= 4 ? listWords(countries.map(THE)) : listWords(regions.slice(0, 3));
  const what = { love: 'a partner finds you more easily and love feels open', career: 'your work is seen and rewarded', home: 'you feel at home, settled and at peace' }[theme];
  const zoneText = lineWords.length
    ? `Your ${THEMEWORD[theme]} places follow ${listWords(lineWords)}${countries.length ? `, through ${listWords(countries.slice(0, 4).map(THE))}` : ''}. Along these lines ${what}.`
    : `Your ${THEMEWORD[theme]} places come from crossings: places where two of your planets meet the angles at once.`;
  // Caution: the hard planet behind most of the care places.
  const hc = {};
  for (const c of careCards) { const m = c.text.match(/^(\w+)/); const q = m ? m[1] : null; if (q) (hc[q] = hc[q] || []).push(c); }
  const cAng = {}; for (const c of careCards) for (const l of c.lines) { const m = l.label.match(/(MC|IC|AC|DC)$/); if (m) cAng[l.planet + '|' + m[1]] = (cAng[l.planet + '|' + m[1]] || 0) + 1; }
  const [cq, cl] = Object.entries(hc).sort((a, b) => b[1].length - a[1].length)[0] || [null, []];
  const cCountries = [...new Set(careCards.map(c => c.country))];
  const area = { love: 'love is hard to find and harder to keep', career: 'work and money are hard to build', home: 'it is hard to feel settled and at peace' }[theme];
  // Oct 28 (Sarah: "why is all Brazil bad when Rio is ok"): places to avoid are points, so name the cities, never whole countries.
  const cCities = careCards.map(c => c.city);
  // Oct 29: when nowhere is negative overall for this report, say so instead of inventing places.
  if (!careCards.length) {
    const none = { love: 'love', career: 'your career and money', home: 'home' }[theme];
    return { zone: { title: zoneTitle.replace(/^the /, 'The '), chips: keys.map(([k]) => { const [p, a] = k.split('|'); return `${nm(p)} on the ${ANGSHORT[a]}`; }), text: zoneText },
             caution: { title: 'Nowhere to avoid', chips: [], text: `No place on your map comes out negative for ${none}. Where your harder planets fall, your stronger ones balance them out.` } };
  }
  const cautionText = cq ? `${HARD[cq] || cq + ' is strong'} in ${listWords(cCities)}; ${area} there. These are the places to avoid, not the countries around them.` : '';
  return { zone: { title: zoneTitle.replace(/^the /, 'The '), chips: keys.map(([k]) => { const [p, a] = k.split('|'); return `${nm(p)} on the ${ANGSHORT[a]}`; }), text: zoneText },
           caution: { title: listWords(cCities), chips: Object.entries(cAng).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => { const [p, a] = k.split('|'); return `${nm(p)} on the ${ANGSHORT[a]}`; }), text: cautionText } };
}

// ── Planets section ────────────────────────────────────────────────────
const PWHY = {
  love: { Venus: 'Your love planet.', Sun: 'On the Descendant, a partner who is central to your life.', Moon: 'On the Descendant, emotional closeness.', Jupiter: 'Generosity and luck in partnership.', NNode: 'On the Descendant, fated meetings.', Saturn: 'Commitment, but also weight in relationships.' },
  career: { Sun: 'Being seen and credited.', Jupiter: 'Recognition, growth and money.', Mars: 'Drive and ambition.', Uranus: 'Independent, unconventional work.', Saturn: 'Authority earned slowly.', Mercury: 'Ideas and deals.', Venus: 'Charm and relationships at work.', Moon: 'Public trust.' },
  home: { Moon: 'Feeling at home, emotional safety.', Venus: 'Beauty and comfort at home.', Jupiter: 'Roots, family, property.', Neptune: 'Peace, rest, intuition.', Sun: 'Being yourself, family.', NNode: 'Roots that fit your path.', Mars: 'Energy and drive at home.' }
};
const VWORD = { harmonious: 'Well placed in your chart, so its lines help.', dynamic: 'Mixed in your chart: its lines bring intensity as well as help.', challenging: 'Challenging in your chart, so its lines are read as cautions.' };
function planets(theme, r) {
  const T = R.THEMES[theme];
  const names = [...Object.keys(T.planets), ...r.rulerNotes.map(x => x.split(' ')[0])];
  for (const [n, v] of Object.entries(r.verdict)) if (v.category === 'challenging' && ['Saturn', 'Mars', 'Mercury'].includes(n)) names.push(n);
  const uniq = [...new Set(names)].filter(n => r.verdict[n]);
  return uniq.map(n => { const v = r.verdict[n]; const ruler = r.rulerNotes.find(x => x.startsWith(n + ' '));
    return { planet: n, name: nm(n), place: `${v.sign}, ${v.house}${['th','st','nd','rd'][v.house % 10 > 3 || [11,12,13].includes(v.house) ? 0 : v.house % 10]} house`, verdict: v.category,
      why: theme === 'love' && n === 'Moon' && v.category !== 'harmonious' ? 'Not well placed in your chart. On the Descendant it can bring emotional dependence, so it is read as a caution there.' : [ruler ? 'Rules ' + ruler.replace(/^\w+ rules /, '') + '.' : '', PWHY[theme][n] || '', VWORD[v.category]].filter(Boolean).join(' ') }; });
}

// ── Where you began ────────────────────────────────────────────────────
function birthplace(all, theme, blat, blng, bname) {
  const r = all[theme];
  const km = (a, b) => { const q = Math.PI / 180, h = Math.sin((b.lat - a.lat) * q / 2) ** 2 + Math.cos(a.lat * q) * Math.cos(b.lat * q) * Math.sin((b.lng - a.lng) * q / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
  const near = r.results.map(x => [km({ lat: blat, lng: blng }, x), x]).sort((a, b) => a[0] - b[0])[0][1];
  const s = near.score;
  const verdict = s >= 0.8 ? `Strong for ${THEMEWORD[theme]}` : s >= 0.3 ? 'A gentle pull' : s > -0.3 ? `Quiet for ${THEMEWORD[theme]}` : 'Asks more of you';
  const c = card(Object.assign({}, near, { display: bname, nearby: [] }), theme, 0);
  let text = c.text;
  if (!text) text = `None of your ${THEMEWORD[theme]} planets is close to an angle where you were born, so ${THEMEWORD[theme]} here depends more on you than on the place.`;
  return { city: bname, why: 'Where you were born', verdict, score: s, text };
}

// ── Method ─────────────────────────────────────────────────────────────
function method(theme, r) {
  const ch = Object.entries(r.verdict).filter(([, v]) => v.category === 'challenging').map(([n]) => nm(n));
  const base = {
    love: 'Love is read from the Descendant, the angle of partnership, and your relocated 7th and 5th houses. Venus, the Sun, the Moon (when well placed), Jupiter and the North Node on the Descendant are love signatures.',
    career: 'Career is read from the Midheaven, the angle of public life, and your relocated 10th and 2nd houses (career and money go together). The Sun, Jupiter, Mars and Uranus at the top of the chart are career signatures.',
    home: 'Home is read from the IC, the angle of home and roots, and your relocated 4th house. The Moon, Venus, Jupiter and Neptune near the IC are home signatures, along with any planet that is strong in your chart.'
  }[theme];
  return [base, r.rulerNotes.length ? r.rulerNotes.join('; ') + ', so those lines count too.' : '',
    ch.length ? `${listWords(ch)} ${ch.length > 1 ? 'are' : 'is'} challenging in your chart, so ${ch.length > 1 ? 'their' : 'its'} lines are read as cautions; Chiron near an angle is read as old wounds coming up.` : 'Chiron near an angle is read as old wounds coming up.',
    'Crossings (parans) count where two of your planets sit on angles at the same moment. Every planet is judged by its verdict in your chart, the same as your Map Guide, and distances are measured from each planet\'s true position, the same as the map. Each place appears in one report only. Positions from Swiss Ephemeris; Placidus houses.'
  ].filter(Boolean).join(' ');
}

// ── Build ──────────────────────────────────────────────────────────────
function build(chart, theme, opts, all) {
  all = all || R.rankAll(chart); all.chart = chart;
  const r = all[theme];
  const cards = r.best.map((p, i) => card(p, theme, i + 1));
  const careCards = r.care.map(p => careCard(p, theme));
  // Oct 30 (Sarah): "Your top lines" replaces the "where to avoid" card in map at a glance (the places-to-avoid
  // section already covers it). The lines this report weighs most for this person, the way Neutrino ranks a category.
  const g = glance(cards, careCards, theme); g.caution = topLines(r, cards, theme);
  return { theme, name: opts.name, birth: opts.birth, glance: g, planets: planets(theme, r),
    best: cards, care: careCards, birthplace: birthplace(all, theme, opts.blat, opts.blng, opts.bname), method: method(theme, r) };
}
module.exports = { build };

if (require.main === module) {
  const [f, theme, name, birth, blat, blng, bname] = process.argv.slice(2);
  const chart = JSON.parse(fs.readFileSync(f, 'utf8'));
  const opts = { name, birth, blat: +blat, blng: +blng, bname };
  if (theme === 'all') { const all = R.rankAll(chart); const out = {}; for (const t of ['love', 'career', 'home']) out[t] = build(chart, t, opts, all); console.log(JSON.stringify(out, null, 1)); }
  else console.log(JSON.stringify(build(chart, theme, opts), null, 1));
}
