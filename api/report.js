// api/report.js — Best Places Report generator for elsewhere
// Uses astrocartography lines + parans + relocated charts + Claude AI

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── City database ────────────────────────────────────────────
// Loaded once at module scope (cold start) — Vercel keeps the function warm
// between invocations, so this 2.6MB JSON is read from disk a single time
// and held in memory for subsequent requests. The list comes from the
// GeoNames cities5000 dump filtered to population ≥ 10,000 (~44,500 places),
// covering every meaningful astrocartography destination worldwide
// including smaller spiritually/culturally significant towns like Sedona.
let CITY_DB_CACHE = null;
function loadCityDB() {
  if (CITY_DB_CACHE) return CITY_DB_CACHE;
  const filePath = path.join(process.cwd(), 'api', 'cities.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  CITY_DB_CACHE = JSON.parse(raw);
  return CITY_DB_CACHE;
}

// ── Category weighting ───────────────────────────────────────
// Each category has weights for line types AND planets, biased toward
// the lines/planets traditionally associated with that life area.
//
// LINE TYPES:
//   MC  = career, public reputation, vocation
//   IC  = home, foundation, inner life, ancestry
//   ASC = self, identity, vitality, how you arrive
//   DSC = partnerships, relationships, what you attract
//
// Higher number = more relevant to this category.
//
// "Best places" framing: these reports surface locations where the user's
// chart sings — opportunity, joy, expansion, restoration. Saturn and Pluto
// are real and meaningful astrological forces, but they signal challenge,
// restriction, and transformation-through-difficulty rather than the
// flourishing energy this product promises. They are filtered out via
// EXCLUDED_PLANETS below, in BOTH line scoring and paran involvement.
const CATEGORY_WEIGHTS = {
  Love: {
    lineTypes: { MC: 0.3, IC: 0.7, ASC: 0.9, DSC: 1.5 },
    planets:   { Venus: 1.5, Moon: 1.2, Jupiter: 1.0, Neptune: 0.9, Mars: 0.7, Sun: 0.6 }
  },
  Career: {
    lineTypes: { MC: 1.5, IC: 0.3, ASC: 1.0, DSC: 0.3 },
    planets:   { Jupiter: 1.5, Sun: 1.3, Mercury: 1.0, Venus: 0.9, Mars: 0.8 }
  },
  Healing: {
    lineTypes: { MC: 0.4, IC: 1.5, ASC: 1.0, DSC: 0.5 },
    planets:   { Chiron: 1.5, Moon: 1.3, Neptune: 1.1, Venus: 0.9, Jupiter: 0.8, Sun: 0.6 }
  }
};

// Planets excluded from "best places" reports across all categories.
// Saturn carries restriction/discipline; Pluto carries upheaval/transformation
// through breakdown. Both are astrologically valid but not "best places" energy.
// Filtered from line scoring AND paran involvement (a paran involving either
// of these is dropped entirely, even if the OTHER planet is category-relevant).
const EXCLUDED_PLANETS = new Set(['Saturn', 'Pluto']);

// ── Preferred planet pools for "one of each" top-3 selection ─────
// For each category, top 3 cities are selected by walking this preference
// list in order, skipping afflicted planets, and picking the best city
// for each remaining planet. This produces three structurally different
// recommendations (different planets, different stories) instead of three
// cities clustered along the same line.
//
// Stays close to the traditional benefics + luminaries (Sun, Moon, Venus,
// Jupiter) — the planets that deliver flourishing energy when they aren't
// afflicted. Chiron is the lead Healing planet and exempt from the
// affliction filter (the wounded healer "afflicts" itself by nature).
const PREFERRED_PLANETS_BY_CATEGORY = {
  Career:  ['Sun', 'Jupiter', 'Venus', 'Moon'],
  Love:    ['Venus', 'Moon', 'Jupiter', 'Sun'],
  Healing: ['Chiron', 'Moon', 'Venus', 'Jupiter', 'Sun']
};

// Planets exempt from the affliction check (always considered usable).
// Chiron is the wounded healer — it represents the healing of difficulty
// itself, so a "natally afflicted Chiron" is its normal state, not a
// reason to skip its line.
const AFFLICTION_EXEMPT = new Set(['Chiron']);

// Tuning knobs for top-3 selection.
const MIN_DISTANCE_KM = 800;        // min distance between top-3 picks
const MIN_ACTIVATION_ORB = 1.5;     // featured planet's line must be within this
const MAX_AFFLICTION_ORB_HARD = 5;  // square/opposition orb tightness
const MAX_AFFLICTION_ORB_CONJ = 6;  // conjunction orb tightness

// Backwards-compat: the planet list per category (used by other code paths)
const CATEGORY_PLANETS = {
  Love:    Object.keys(CATEGORY_WEIGHTS.Love.planets),
  Career:  Object.keys(CATEGORY_WEIGHTS.Career.planets),
  Healing: Object.keys(CATEGORY_WEIGHTS.Healing.planets)
};

// ── Math helpers ─────────────────────────────────────────────
const R = d => d * Math.PI / 180;
const D = r => r * 180 / Math.PI;
const n180 = x => ((x + 540) % 360) - 180;
const n360 = x => ((x % 360) + 360) % 360;

// ── Find distance from city to a line ────────────────────────
function distToLine(cityLat, cityLng, linePoints) {
  if (!linePoints || linePoints.length === 0) return 999;
  let minDist = 999;
  for (const [lat, lng] of linePoints) {
    const dlat = Math.abs(cityLat - lat);
    let dlng = Math.abs(cityLng - lng);
    if (dlng > 180) dlng = 360 - dlng;
    const d = Math.sqrt(dlat * dlat + dlng * dlng);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// ── Great-circle distance between two cities, in km ──────────
// Used to enforce geographic spread between the top 3 picks so we don't
// return three near-identical cities riding the same planetary line.
function haversineKm(lat1, lng1, lat2, lng2) {
  const E = 6371; // Earth radius in km
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
  return E * 2 * Math.asin(Math.sqrt(a));
}

// ── Detect natally afflicted planets from aspect data ────────
// A planet is "afflicted" when a malefic (Saturn/Mars/Pluto) sits in
// hard aspect to it within tight orb. Recommending, say, a Venus line
// to someone whose Venus is squared by Saturn would deliver Saturnian
// sorrow in love, not Venusian ease — so we filter such lines out.
//
// Returns a Set of planet names that should be skipped for "best places".
// Mars/Saturn/Pluto themselves are not added (they're already in
// EXCLUDED_PLANETS globally). Chiron is removed from the result if
// present (see AFFLICTION_EXEMPT).
function getAfflictedPlanets(aspects) {
  const afflicted = new Set();
  if (!aspects || aspects.length === 0) return afflicted;

  const malefics = new Set(['Saturn', 'Mars', 'Pluto']);

  for (const aspect of aspects) {
    const orb = Math.abs(aspect.orb || 0);
    const type = aspect.type;
    const p1 = aspect.p1;
    const p2 = aspect.p2;
    if (!p1 || !p2 || !type) continue;

    // Affliction signal: hard aspect from a malefic, within tight orb.
    let isAfflicting = false;
    if ((type === 'square' || type === 'opposition') && orb <= MAX_AFFLICTION_ORB_HARD) {
      isAfflicting = true;
    } else if (type === 'conjunction' && orb <= MAX_AFFLICTION_ORB_CONJ) {
      isAfflicting = true;
    }
    if (!isAfflicting) continue;

    const p1Malefic = malefics.has(p1);
    const p2Malefic = malefics.has(p2);

    // If exactly one party is a malefic, the other party is afflicted by it.
    // (Both malefic → already excluded globally; both benefic → not afflicting.)
    if (p1Malefic && !p2Malefic) afflicted.add(p2);
    if (p2Malefic && !p1Malefic) afflicted.add(p1);
  }

  // Remove exempt planets (Chiron) from the afflicted set
  for (const exempt of AFFLICTION_EXEMPT) afflicted.delete(exempt);
  return afflicted;
}

// ── Pick top-3 cities using "one of each preferred planet" ─────
// Walks the category's preferred planet list in order, skipping any
// afflicted ones, and finds the best city for each remaining planet
// (where "best" means: tightest line activation for that specific
// planet that also clears MIN_ACTIVATION_ORB and is at least
// MIN_DISTANCE_KM from already-picked cities).
//
// This replaces the older "sort all by score, take top 3" approach,
// which produced 3 near-identical cities along a single tight line.
//
// Falls back to highest-score remaining cities if the preferred-planet
// path doesn't fill 3 slots (e.g. heavily afflicted chart).
function pickTopByPreferredPlanets(scored, category, afflictedPlanets) {
  const targetCount = 3;
  const preferred = PREFERRED_PLANETS_BY_CATEGORY[category] || [];
  const picks = [];
  const usedPlanets = new Set();
  const usedCityKeys = new Set();
  const cityKey = c => `${c.n}|${c.c}|${c.lat}|${c.lng}`;

  // Sum the line score contributed by a specific planet at a city,
  // used to rank candidates within a preferred-planet bucket.
  const planetScoreAtCity = (s, planet) =>
    s.activations
      .filter(a => a.type === 'line' && a.planet === planet)
      .reduce((sum, a) => sum + (a.weight || 0) * (3 - a.dist) * 10, 0);

  // 1) Walk the preferred-planet list, picking the best city for each.
  for (const planet of preferred) {
    if (picks.length >= targetCount) break;
    if (usedPlanets.has(planet)) continue;
    if (afflictedPlanets.has(planet) && !AFFLICTION_EXEMPT.has(planet)) continue;

    const candidates = scored.filter(s => {
      if (usedCityKeys.has(cityKey(s.city))) return false;

      // Must have a line activation from THIS planet within the orb threshold.
      const hasFeaturedLine = s.activations.some(a =>
        a.type === 'line' && a.planet === planet && a.dist <= MIN_ACTIVATION_ORB
      );
      if (!hasFeaturedLine) return false;

      // Must be far enough from already-picked cities.
      for (const pick of picks) {
        const km = haversineKm(s.city.lat, s.city.lng, pick.city.lat, pick.city.lng);
        if (km < MIN_DISTANCE_KM) return false;
      }
      return true;
    });

    if (candidates.length === 0) continue;

    // Among candidates, pick the one where THIS planet contributes most.
    candidates.sort((a, b) => planetScoreAtCity(b, planet) - planetScoreAtCity(a, planet));
    const winner = candidates[0];
    picks.push({ ...winner, featuredPlanet: planet });
    usedPlanets.add(planet);
    usedCityKeys.add(cityKey(winner.city));
  }

  // 2) Fallback: if we couldn't fill targetCount via preferred planets
  // (e.g. heavily afflicted chart, or no preferred planet had any city
  // within the orb threshold), fill remaining slots from highest-scoring
  // cities, still applying geographic dedupe.
  if (picks.length < targetCount) {
    const byScore = [...scored].sort((a, b) => b.score - a.score);
    for (const candidate of byScore) {
      if (picks.length >= targetCount) break;
      if (usedCityKeys.has(cityKey(candidate.city))) continue;
      const tooClose = picks.some(p =>
        haversineKm(candidate.city.lat, candidate.city.lng, p.city.lat, p.city.lng) < MIN_DISTANCE_KM
      );
      if (tooClose) continue;
      // Featured planet for fallback picks: the strongest line activation.
      const strongestLine = [...candidate.activations]
        .filter(a => a.type === 'line')
        .sort((a, b) => (b.weight || 0) * (3 - b.dist) - (a.weight || 0) * (3 - a.dist))[0];
      picks.push({
        ...candidate,
        featuredPlanet: strongestLine ? strongestLine.planet : null
      });
      usedCityKeys.add(cityKey(candidate.city));
    }
  }

  return picks;
}

// ── Calculate parans ─────────────────────────────────────────
// A paran occurs when two planets share the same horizon/meridian simultaneously
// Returns latitude bands where each planet pair has a paran
function calculateParans(acgLines, planets) {
  const parans = [];
  const planetNames = Object.keys(acgLines);

  for (let i = 0; i < planetNames.length; i++) {
    for (let j = i + 1; j < planetNames.length; j++) {
      const p1 = planetNames[i];
      const p2 = planetNames[j];
      const l1 = acgLines[p1];
      const l2 = acgLines[p2];
      if (!l1 || !l2) continue;

      // For each line type combination find intersecting latitudes
      const linePairs = [
        ['MC', 'MC'], ['MC', 'IC'], ['MC', 'ASC'], ['MC', 'DSC'],
        ['IC', 'ASC'], ['IC', 'DSC'], ['ASC', 'DSC']
      ];

      for (const [lt1, lt2] of linePairs) {
        const pts1 = l1[lt1];
        const pts2 = l2[lt2];
        if (!pts1 || !pts2) continue;

        // Find latitudes where these lines are close (within 2 degrees longitude)
        for (const [lat1, lng1] of pts1) {
          for (const [lat2, lng2] of pts2) {
            if (Math.abs(lat1 - lat2) < 1.0) {
              let dlng = Math.abs(lng1 - lng2);
              if (dlng > 180) dlng = 360 - dlng;
              if (dlng < 2.0) {
                parans.push({
                  planet1: p1,
                  planet2: p2,
                  line1: lt1,
                  line2: lt2,
                  latitude: (lat1 + lat2) / 2,
                  longitude: (lng1 + lng2) / 2,
                  orb: dlng
                });
              }
            }
          }
        }
      }
    }
  }

  // Deduplicate nearby parans
  const deduped = [];
  for (const p of parans) {
    const existing = deduped.find(d =>
      d.planet1 === p.planet1 && d.planet2 === p.planet2 &&
      Math.abs(d.latitude - p.latitude) < 3
    );
    if (!existing) deduped.push(p);
  }

  return deduped;
}

// ── Score a city for a given category ────────────────────────
// `afflictedPlanets` is a Set of planet names whose lines/parans should
// be skipped for THIS user (computed from natal aspects via
// getAfflictedPlanets). Defaults to empty so existing callers still work.
function scoreCity(city, acgLines, parans, category, planets, afflictedPlanets = new Set()) {
  const activations = [];

  const weights = CATEGORY_WEIGHTS[category];
  if (!weights) return { score: 0, activations: [] };

  const planetWeights = weights.planets;
  const lineWeights = weights.lineTypes;
  const categoryPlanets = Object.keys(planetWeights);

  // A planet is "skipped" if globally excluded OR afflicted for this user.
  // Chiron is exempt from the affliction filter (see AFFLICTION_EXEMPT).
  const isSkipped = planet =>
    EXCLUDED_PLANETS.has(planet) ||
    (afflictedPlanets.has(planet) && !AFFLICTION_EXEMPT.has(planet));

  let lineScore = 0;
  let paranScore = 0;

  // 1. Check line distances for category planets, weighted by line type AND planet
  for (const planet of categoryPlanets) {
    if (isSkipped(planet)) continue;
    const lines = acgLines[planet];
    if (!lines) continue;

    const planetWeight = planetWeights[planet] || 0.5;

    for (const lt of ['MC', 'IC', 'ASC', 'DSC']) {
      const pts = lines[lt];
      if (!pts) continue;
      const dist = distToLine(city.lat, city.lng, pts);

      if (dist < 2) {
        const strength = dist < 0.5 ? 'exact' : dist < 1 ? 'strong' : 'moderate';
        const lineWeight = lineWeights[lt] || 0.5;
        // Weighted score: closer distance + heavier line type + heavier planet = bigger bump
        lineScore += (3 - dist) * 10 * lineWeight * planetWeight;
        activations.push({
          planet,
          lineType: lt,
          dist,
          strength,
          type: 'line',
          weight: lineWeight * planetWeight
        });
      }
    }
  }

  // 2. Check parans at this latitude (using accurate server-calculated parans)
  // Parans are SUPPORTING signals — they add texture but cannot drive city selection
  // on their own. A city with no relevant lines should not qualify from parans alone.
  for (const paran of parans) {
    // Drop parans involving any skipped planet (globally excluded OR
    // afflicted for this user). Even if the OTHER planet is category-relevant
    // (e.g. Sun/Saturn for someone with afflicted Sun), the contamination is
    // enough to exclude — keeps the narrative focused on positive, unimpeded
    // planetary contacts.
    if (isSkipped(paran.planet1) || isSkipped(paran.planet2)) continue;
    const latDiff = Math.abs(city.lat - paran.latitude);
    if (latDiff < 3) {
      const p1 = paran.planet1;
      const p2 = paran.planet2;
      // Average the planet weights of the two planets in the paran
      const w1 = planetWeights[p1] || 0;
      const w2 = planetWeights[p2] || 0;
      const relevance = (w1 + w2) / 2;
      if (relevance > 0) {
        // Orb tightness — clamped to [0, 1] so wide orbs contribute less,
        // never negatively. (Previous formula went negative for orbs > 1.)
        const orbTightness = Math.max(0, 1 - (paran.orb || 0) / 2);
        const ps = (3 - latDiff) * orbTightness * 8 * relevance;
        paranScore += ps;
        activations.push({
          planet1: p1,
          planet2: p2,
          line1: paran.line1,
          line2: paran.line2,
          latitude: paran.latitude,
          longitude: paran.longitude,
          latDiff,
          orb: paran.orb,
          type: 'paran',
          relevance
        });
      }
    }
  }

  // Cap paran contribution at 100% of line score. Parans can match but not
  // exceed the line score's contribution — so a city with a tight MC line
  // plus rich paran activation can outrank a city with a weaker line alone.
  // A city with zero line activations still gets zero score regardless of parans.
  const cappedParanScore = Math.min(paranScore, lineScore);
  const score = lineScore + cappedParanScore;

  return { score, activations };
}

// ── Houses ────────────────────────────────────────────────────
// House calculation is intentionally not present at this layer.
// Computing accurate relocated houses requires sidereal time math
// (ideally Placidus or Whole Sign cusps via pyswisseph) and will be
// added by extending astro.py to return relocated charts. Until then,
// the report intentionally avoids any claim about house placement.

// ── Main handler ─────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { category, chartData, userId } = req.body;

  if (!category || !chartData) {
    return res.status(400).json({ error: 'category and chartData required' });
  }

  if (!CATEGORY_PLANETS[category]) {
    return res.status(400).json({ error: 'Invalid category. Use: Love, Career, or Healing' });
  }

  try {
    const { jd, birthLat, birthLng, birthPlace, birthDate, birthTime,
            name, planets, aspects, acgLines, parans: chartParans } = chartData;
    // Use real parans from server calculation
    const chartData_parans = chartParans || [];

    const categoryPlanets = CATEGORY_PLANETS[category];

    // Use server-calculated parans from astro.py (accurate LST-based calculation)
    // Falls back to approximate calculation if not available
    const parans = chartData_parans.length > 0
      ? chartData_parans
      : calculateParans(acgLines, planets);

    // ── Detect afflicted planets from natal aspect data ──
    // Planets in hard aspect (square/opposition/conjunction) to a malefic
    // (Saturn/Mars/Pluto) within tight orb. Their lines won't deliver the
    // pure planetary energy promised by the report, so we filter them.
    const afflictedPlanets = getAfflictedPlanets(aspects);

    // Score every city in the database
    const CITY_DB = loadCityDB();
    const scored = CITY_DB.map(city => {
      const { score, activations } = scoreCity(
        city, acgLines, parans, category, planets, afflictedPlanets
      );
      return { city, score, activations };
    }).filter(c => c.score > 0 && c.activations.length > 0);

    // ── Pick top 3 via "one of each preferred planet" ──
    // Walks the category's preferred planets (Sun/Moon/Venus/Jupiter, plus
    // Chiron for Healing) in priority order, skipping afflicted ones, and
    // selects the best city for each remaining planet. Geographic dedupe
    // ensures the three picks are at least MIN_DISTANCE_KM apart.
    // Falls back to highest-score remaining cities if the preferred path
    // doesn't fill 3 slots.
    const top3 = pickTopByPreferredPlanets(scored, category, afflictedPlanets);

    // ── DEBUG: log top 10 raw scores AND the picks we actually returned ──
    // (Single JSON.stringify call so Vercel captures it as one log entry)
    const byScoreForDebug = [...scored].sort((a, b) => b.score - a.score);
    const debugPayload = {
      buildVersion: 'DIVERSIFIED-v6',
      category,
      afflictedPlanets: [...afflictedPlanets],
      picks: top3.map((c, i) => ({
        rank: i + 1,
        city: `${c.city.n}, ${c.city.c}`,
        featuredPlanet: c.featuredPlanet || null,
        score: Number(c.score.toFixed(2))
      })),
      top10ByRawScore: byScoreForDebug.slice(0, 10).map((c, i) => {
        const lineActs = c.activations
          .filter(a => a.type === 'line')
          .map(a => ({
            planet: a.planet,
            line: a.lineType,
            dist: Number(a.dist.toFixed(2)),
            weight: Number((a.weight || 0).toFixed(2))
          }));
        const paranCount = c.activations.filter(a => a.type === 'paran').length;
        return {
          rank: i + 1,
          city: `${c.city.n}, ${c.city.c}`,
          score: Number(c.score.toFixed(2)),
          lines: lineActs,
          parans: paranCount
        };
      })
    };
    console.log('REPORT_DEBUG ' + JSON.stringify(debugPayload));

    if (top3.length === 0) {
      return res.status(200).json({
        report: null,
        message: 'No strong activations found for this category.'
      });
    }

    // Build context for each city — line activations + parans only.
    // House shift calculations have been removed pending proper relocated-chart
    // computation via astro.py (planned). Equal-house approximations from the
    // front-end Ascendant were producing inaccurate house assignments.
    const cityContexts = top3.map(({ city, activations, featuredPlanet }) => {
      const allLines = activations.filter(a => a.type === 'line');

      // Within the featured planet's lines at this city, take the tightest one
      // — that's what we'll lead the city write-up with. The rest of the
      // activations are sorted by weight × tightness for supporting context.
      const featuredLines = allLines
        .filter(a => featuredPlanet && a.planet === featuredPlanet)
        .sort((a, b) => a.dist - b.dist);
      const featuredLine = featuredLines[0] || null;

      const otherLines = allLines
        .filter(a => a !== featuredLine)
        .sort((a, b) => {
          const wA = (a.weight || 1) * (3 - a.dist);
          const wB = (b.weight || 1) * (3 - b.dist);
          return wB - wA;
        });

      // Featured line first, then everything else by importance.
      const orderedLines = featuredLine ? [featuredLine, ...otherLines] : otherLines;

      const lineActivations = orderedLines
        .map(a => `${a.planet} ${a.lineType} line (${a.strength} — ${a.dist.toFixed(1)}°)`)
        .join(', ');

      const primaryActivation = orderedLines[0]
        ? `${orderedLines[0].planet} ${orderedLines[0].lineType}`
        : null;

      const paranActivations = activations
        .filter(a => a.type === 'paran')
        .map(a => `${a.planet1}/${a.planet2} paran at ${a.latitude.toFixed(1)}°N/S latitude`)
        .join(', ');

      return {
        cityName: `${city.n}, ${city.c}`,
        lat: city.lat,
        lng: city.lng,
        featuredPlanet: featuredPlanet || null,
        lineActivations,
        primaryActivation,
        paranActivations,
        activationCount: activations.length
      };
    });

    // Format aspects for Claude
    const relevantAspects = (aspects || [])
      .filter(a => categoryPlanets.some(p => p === a.p1 || p === a.p2))
      .slice(0, 8)
      .map(a => `${a.p1} ${a.type} ${a.p2} (${a.orb}° orb)`)
      .join(', ');

    // Format natal chart context
    const natalContext = Object.entries(planets)
      .filter(([k]) => !k.startsWith('_') && planets[k]?.sign)
      .map(([k, v]) => `${k}: ${v.deg}° ${v.sign}`)
      .join(', ');

    // Build Claude prompt
    const prompt = `You are writing a personalised astrocartography report for elsewhere, a premium astrology app. The report is for the "${category}" category.

TONE: Honest, grounded, poetic but specific. Acknowledge both the gifts and the challenges of each location. Never vague. Always tied to the specific planetary activations.

ASTROCARTOGRAPHY LINE TYPES — use the correct meaning for each:
- MC line = career, public reputation, vocation, recognition (the strongest career axis)
- IC line = home, foundation, inner life, ancestry, deep restoration
- ASC line = self, identity, vitality, how the user presents and arrives in a place
- DSC line = partnerships, relationships, what the user attracts from others (the strongest love axis)

Do not call a DSC line a "career line" or an MC line a "love line." Honour the actual axis.

CRITICAL ACCURACY RULES:
- Do NOT make claims about which house any planet is in, either natally or in the relocated chart. House data is not provided to you and inventing it produces astrologically inaccurate readings.
- Do NOT describe how houses "shift" between the user's birthplace and any city in this report. That information is not available.
- DO reference the user's actual planet placements by SIGN when relevant (e.g., "your Venus in Scorpio"). The degrees are provided to you for accuracy of interpretation, but DO NOT recite the exact degree numbers in the prose — write naturally, the way a thoughtful astrologer would speak. Saying "your Venus at 6° Scorpio" reads like a textbook; saying "your Venus in Scorpio" reads like a reading.
- DO reference the line activations and parans listed below — those are the verified data for this report. When mentioning a line orb, you may say "tight" or "exact" rather than reciting the decimal.
- If you cannot make a specific astrologically grounded claim about something, do not make it. Vague flourish is worse than honest specificity.

USER'S BIRTH DATA:
- Name: ${name || 'the user'}
- Birth: ${birthDate} at ${birthTime}
- Birthplace: ${birthPlace}
- Natal placements (sign and degree): ${natalContext}
- Relevant aspects: ${relevantAspects || 'none within orb'}

TOP 3 CITIES FOR ${category.toUpperCase()}:
Each city below has been selected for a DIFFERENT featured planet, so the three cities tell three structurally distinct stories rather than three variations on the same line. For each city, the "Primary activation" is the planet/line that defines that location's character — build the entire city section around it. The other lines and parans listed are SUPPORTING layers, woven in only after the featured planet's story is established. Do not lead with a supporting line.

${cityContexts.map((ctx, i) => `
${i + 1}. ${ctx.cityName}
   Primary activation: ${ctx.primaryActivation || 'none'}
   All lines activated (strongest first): ${ctx.lineActivations || 'none'}
   Parans: ${ctx.paranActivations || 'none'}
`).join('')}

Write a ${category} report with this exact structure:

---INTRO---
2-3 sentences introducing what ${category.toLowerCase()} looks like in this person's natal chart specifically. Reference the planets most relevant to ${category.toLowerCase()} by sign (not degree), and ALSO reference the relevant angle sign if it appears in the natal placements above:
- For Career, anchor in their Sun, Jupiter, Mercury, and Mars placements, AND their MC sign if available — the MC sign reveals the public face their career energy seeks.
- For Love, anchor in their Venus, Moon, Mars, and Neptune placements, AND their DSC sign if available — the DSC sign reveals the kind of partner they're built to attract.
- For Healing, anchor in their Chiron, Moon, Neptune, and Venus placements, AND their IC sign if available — the IC sign reveals where their deepest restoration takes root.
If the relevant angle sign is not provided in the natal placements, do not reference it — never invent or assume one. What is the quality of their ${category.toLowerCase()} energy at their birthplace?

---CITY 1: ${cityContexts[0]?.cityName}---
A full, rich reading of what ${category.toLowerCase()} means for this specific person in this specific city. Minimum 150 words.
- LEAD with the primary activation listed above. Name the planet, the line type, and what that combination genuinely means for ${category.toLowerCase()} in this city.
- Then weave in the other lines and parans as supporting layers — not as the headline.
- Describe what life could actually feel like here for them in the ${category.toLowerCase()} domain.
- Be honest about challenges as well as gifts.
- Do NOT invent house placements or house shifts.

---CITY 2: ${cityContexts[1]?.cityName}---
Same structure as City 1: lead with the primary activation, layer in the rest. Minimum 150 words. Make it feel completely different from City 1.

---CITY 3: ${cityContexts[2]?.cityName}---
Same structure. Minimum 150 words. Make it feel completely different from the others.

---CLOSING---
2-3 sentences reflecting on the overall pattern of where ${category.toLowerCase()} finds this person in the world. What does the map reveal about their ${category.toLowerCase()} story?

Write only the report content. No preamble, no "Here is your report". Start directly with the intro.`;

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const reportText = response.content[0].text;

    // Save report to Supabase if user is logged in
    if (userId) {
      await supabase.from('reports').insert({
        user_id: userId,
        category,
        city1: cityContexts[0]?.cityName,
        city2: cityContexts[1]?.cityName,
        city3: cityContexts[2]?.cityName,
        report_text: reportText,
        created_at: new Date().toISOString()
      }).then(r => { if (r.error) console.error('Save report error:', r.error); });
    }

    return res.json({
      report: reportText,
      cities: cityContexts.map(c => c.cityName),
      paransFound: parans.length
    });

  } catch (err) {
    console.error('Report generation error:', err);
    return res.status(500).json({ error: 'Failed to generate report', details: err.message });
  }
}

