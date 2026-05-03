// api/report.js — Best Places Report generator for elsewhere
// Uses astrocartography lines + parans + relocated charts + Claude AI

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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
const CATEGORY_WEIGHTS = {
  Love: {
    lineTypes: { MC: 0.4, IC: 0.7, ASC: 0.8, DSC: 1.5 },
    planets:   { Venus: 1.5, Moon: 1.3, Neptune: 1.0, Jupiter: 0.9 }
  },
  Career: {
    lineTypes: { MC: 1.5, IC: 0.6, ASC: 0.8, DSC: 0.3 },
    planets:   { Jupiter: 1.5, Sun: 1.4, Mercury: 1.0, Mars: 0.9, Saturn: 0.7, Venus: 0.7 }
  },
  Healing: {
    lineTypes: { MC: 0.5, IC: 1.5, ASC: 0.9, DSC: 0.6 },
    planets:   { Chiron: 1.5, Moon: 1.3, Neptune: 1.0, Venus: 0.9 }
  }
};

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
function scoreCity(city, acgLines, parans, category, planets) {
  const activations = [];

  const weights = CATEGORY_WEIGHTS[category];
  if (!weights) return { score: 0, activations: [] };

  const planetWeights = weights.planets;
  const lineWeights = weights.lineTypes;
  const categoryPlanets = Object.keys(planetWeights);

  let lineScore = 0;
  let paranScore = 0;

  // 1. Check line distances for category planets, weighted by line type AND planet
  for (const planet of categoryPlanets) {
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
    const latDiff = Math.abs(city.lat - paran.latitude);
    if (latDiff < 3) {
      const p1 = paran.planet1;
      const p2 = paran.planet2;
      // Average the planet weights of the two planets in the paran
      const w1 = planetWeights[p1] || 0;
      const w2 = planetWeights[p2] || 0;
      const relevance = (w1 + w2) / 2;
      if (relevance > 0) {
        const ps = (3 - latDiff) * (1 - paran.orb) * 8 * relevance;
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

  // Cap paran contribution at 50% of line score. This ensures lines drive
  // city ranking and parans add supporting texture, not the other way around.
  // A city with zero line activations gets zero score regardless of parans.
  const cappedParanScore = Math.min(paranScore, lineScore * 0.5);
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

    // Score every city in the database
    const CITY_DB = getCityDB(); // defined below
    const scored = CITY_DB.map(city => {
      const { score, activations } = scoreCity(
        city, acgLines, parans, category, planets
      );
      return { city, score, activations };
    }).filter(c => c.score > 0 && c.activations.length > 0);

    // Sort by score, take top 3
    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3);

    // ── DEBUG: log top 10 city scores so we can verify weighting works ──
    // (Single JSON.stringify call so Vercel captures it as one log entry)
    const debugPayload = {
      buildVersion: 'PARAN-CAP-v4',
      category,
      top10: scored.slice(0, 10).map((c, i) => {
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
    const cityContexts = top3.map(({ city, activations }) => {
      // Format activations for readability — sorted by weighted importance
      // (strongest, most category-relevant lines first)
      const sortedLineActivations = activations
        .filter(a => a.type === 'line')
        .sort((a, b) => {
          const wA = (a.weight || 1) * (3 - a.dist);
          const wB = (b.weight || 1) * (3 - b.dist);
          return wB - wA;
        });

      const lineActivations = sortedLineActivations
        .map(a => `${a.planet} ${a.lineType} line (${a.strength} — ${a.dist.toFixed(1)}°)`)
        .join(', ');

      const primaryActivation = sortedLineActivations[0]
        ? `${sortedLineActivations[0].planet} ${sortedLineActivations[0].lineType}`
        : null;

      const paranActivations = activations
        .filter(a => a.type === 'paran')
        .map(a => `${a.planet1}/${a.planet2} paran at ${a.latitude.toFixed(1)}°N/S latitude`)
        .join(', ');

      return {
        cityName: `${city.n}, ${city.c}`,
        lat: city.lat,
        lng: city.lng,
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
The cities below are listed in order of strongest match for ${category.toLowerCase()}. For each city, the lines are listed STRONGEST FIRST — lead with the first line listed. The "Primary activation" is the most important line for this city; build the city section around it.

${cityContexts.map((ctx, i) => `
${i + 1}. ${ctx.cityName}
   Primary activation: ${ctx.primaryActivation || 'none'}
   All lines activated (strongest first): ${ctx.lineActivations || 'none'}
   Parans: ${ctx.paranActivations || 'none'}
`).join('')}

Write a ${category} report with this exact structure:

---INTRO---
2-3 sentences introducing what ${category.toLowerCase()} looks like in this person's natal chart specifically. Reference the planets most relevant to ${category.toLowerCase()} by sign (not degree). For Career, this means anchoring in their Sun, Jupiter, Mercury, and Mars placements — the planets that define vocational drive and visibility. For Love, anchor in Venus, Moon, Mars, and Neptune. For Healing, anchor in Chiron, Moon, Neptune, and Saturn. What is the quality of their ${category.toLowerCase()} energy at their birthplace?

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

// ── City database (abbreviated — use full CITY_DB from app.js) ──
function getCityDB() {
  return [
    {n:'New York',c:'United States',lat:40.7128,lng:-74.0060},
    {n:'Los Angeles',c:'United States',lat:34.0522,lng:-118.2437},
    {n:'Chicago',c:'United States',lat:41.8781,lng:-87.6298},
    {n:'Houston',c:'United States',lat:29.7604,lng:-95.3698},
    {n:'Phoenix',c:'United States',lat:33.4484,lng:-112.074},
    {n:'Philadelphia',c:'United States',lat:39.9526,lng:-75.1652},
    {n:'San Antonio',c:'United States',lat:29.4241,lng:-98.4936},
    {n:'San Diego',c:'United States',lat:32.7157,lng:-117.1611},
    {n:'Dallas',c:'United States',lat:32.7767,lng:-96.797},
    {n:'San Francisco',c:'United States',lat:37.7749,lng:-122.4194},
    {n:'Seattle',c:'United States',lat:47.6062,lng:-122.3321},
    {n:'Denver',c:'United States',lat:39.7392,lng:-104.9903},
    {n:'Boston',c:'United States',lat:42.3601,lng:-71.0589},
    {n:'Atlanta',c:'United States',lat:33.749,lng:-84.388},
    {n:'Miami',c:'United States',lat:25.7617,lng:-80.1918},
    {n:'Austin',c:'United States',lat:30.2672,lng:-97.7431},
    {n:'Nashville',c:'United States',lat:36.1627,lng:-86.7816},
    {n:'Portland',c:'United States',lat:45.5051,lng:-122.675},
    {n:'New Orleans',c:'United States',lat:29.9511,lng:-90.0715},
    {n:'Honolulu',c:'United States',lat:21.3069,lng:-157.8583},
    {n:'Toronto',c:'Canada',lat:43.6532,lng:-79.3832},
    {n:'Montreal',c:'Canada',lat:45.5017,lng:-73.5673},
    {n:'Vancouver',c:'Canada',lat:49.2827,lng:-123.1207},
    {n:'London',c:'United Kingdom',lat:51.5074,lng:-0.1278},
    {n:'Edinburgh',c:'United Kingdom',lat:55.9533,lng:-3.1883},
    {n:'Paris',c:'France',lat:48.8566,lng:2.3522},
    {n:'Nice',c:'France',lat:43.7102,lng:7.262},
    {n:'Berlin',c:'Germany',lat:52.52,lng:13.405},
    {n:'Munich',c:'Germany',lat:48.1351,lng:11.582},
    {n:'Hamburg',c:'Germany',lat:53.5753,lng:10.0153},
    {n:'Madrid',c:'Spain',lat:40.4168,lng:-3.7038},
    {n:'Barcelona',c:'Spain',lat:41.3851,lng:2.1734},
    {n:'Seville',c:'Spain',lat:37.3891,lng:-5.9845},
    {n:'Rome',c:'Italy',lat:41.9028,lng:12.4964},
    {n:'Milan',c:'Italy',lat:45.4654,lng:9.1859},
    {n:'Florence',c:'Italy',lat:43.7696,lng:11.2558},
    {n:'Venice',c:'Italy',lat:45.4408,lng:12.3155},
    {n:'Amsterdam',c:'Netherlands',lat:52.3676,lng:4.9041},
    {n:'Brussels',c:'Belgium',lat:50.8503,lng:4.3517},
    {n:'Zurich',c:'Switzerland',lat:47.3769,lng:8.5417},
    {n:'Vienna',c:'Austria',lat:48.2082,lng:16.3738},
    {n:'Prague',c:'Czech Republic',lat:50.0755,lng:14.4378},
    {n:'Budapest',c:'Hungary',lat:47.4979,lng:19.0402},
    {n:'Warsaw',c:'Poland',lat:52.2297,lng:21.0122},
    {n:'Athens',c:'Greece',lat:37.9838,lng:23.7275},
    {n:'Lisbon',c:'Portugal',lat:38.7223,lng:-9.1393},
    {n:'Porto',c:'Portugal',lat:41.1579,lng:-8.6291},
    {n:'Stockholm',c:'Sweden',lat:59.3293,lng:18.0686},
    {n:'Oslo',c:'Norway',lat:59.9139,lng:10.7522},
    {n:'Copenhagen',c:'Denmark',lat:55.6761,lng:12.5683},
    {n:'Helsinki',c:'Finland',lat:60.1699,lng:24.9384},
    {n:'Dublin',c:'Ireland',lat:53.3498,lng:-6.2603},
    {n:'Istanbul',c:'Turkey',lat:41.0082,lng:28.9784},
    {n:'Moscow',c:'Russia',lat:55.7558,lng:37.6173},
    {n:'Cairo',c:'Egypt',lat:30.0444,lng:31.2357},
    {n:'Dubai',c:'UAE',lat:25.2048,lng:55.2708},
    {n:'Tel Aviv',c:'Israel',lat:32.0853,lng:34.7818},
    {n:'Mumbai',c:'India',lat:19.076,lng:72.8777},
    {n:'Delhi',c:'India',lat:28.7041,lng:77.1025},
    {n:'Bangalore',c:'India',lat:12.9716,lng:77.5946},
    {n:'Bangkok',c:'Thailand',lat:13.7563,lng:100.5018},
    {n:'Singapore',c:'Singapore',lat:1.3521,lng:103.8198},
    {n:'Kuala Lumpur',c:'Malaysia',lat:3.139,lng:101.6869},
    {n:'Jakarta',c:'Indonesia',lat:-6.2088,lng:106.8456},
    {n:'Bali',c:'Indonesia',lat:-8.4095,lng:115.1889},
    {n:'Tokyo',c:'Japan',lat:35.6762,lng:139.6503},
    {n:'Osaka',c:'Japan',lat:34.6937,lng:135.5023},
    {n:'Kyoto',c:'Japan',lat:35.0116,lng:135.7681},
    {n:'Seoul',c:'South Korea',lat:37.5665,lng:126.978},
    {n:'Shanghai',c:'China',lat:31.2304,lng:121.4737},
    {n:'Beijing',c:'China',lat:39.9042,lng:116.4074},
    {n:'Hong Kong',c:'China',lat:22.3193,lng:114.1694},
    {n:'Sydney',c:'Australia',lat:-33.8688,lng:151.2093},
    {n:'Melbourne',c:'Australia',lat:-37.8136,lng:144.9631},
    {n:'Auckland',c:'New Zealand',lat:-36.8509,lng:174.7645},
    {n:'São Paulo',c:'Brazil',lat:-23.5505,lng:-46.6333},
    {n:'Rio de Janeiro',c:'Brazil',lat:-22.9068,lng:-43.1729},
    {n:'Buenos Aires',c:'Argentina',lat:-34.6037,lng:-58.3816},
    {n:'Santiago',c:'Chile',lat:-33.4489,lng:-70.6693},
    {n:'Lima',c:'Peru',lat:-12.0464,lng:-77.0428},
    {n:'Bogotá',c:'Colombia',lat:4.711,lng:-74.0721},
    {n:'Mexico City',c:'Mexico',lat:19.4326,lng:-99.1332},
    {n:'Nairobi',c:'Kenya',lat:-1.2921,lng:36.8219},
    {n:'Cape Town',c:'South Africa',lat:-33.9249,lng:18.4241},
    {n:'Johannesburg',c:'South Africa',lat:-26.2041,lng:28.0473},
    {n:'Lagos',c:'Nigeria',lat:6.5244,lng:3.3792},
    {n:'Marrakesh',c:'Morocco',lat:31.6295,lng:-7.9811},
    {n:'Reykjavik',c:'Iceland',lat:64.1265,lng:-21.8174},
    {n:'Chiang Mai',c:'Thailand',lat:18.7883,lng:98.9853},
    {n:'Ubud',c:'Indonesia',lat:-8.5069,lng:115.2625},
    {n:'Medellín',c:'Colombia',lat:6.2518,lng:-75.5636},
    {n:'Tbilisi',c:'Georgia',lat:41.6938,lng:44.8015},
    {n:'Sarajevo',c:'Bosnia',lat:43.8476,lng:18.3564},
    {n:'Kotor',c:'Montenegro',lat:42.4247,lng:18.7712},
    {n:'Dubrovnik',c:'Croatia',lat:42.6507,lng:18.0944},
    {n:'Split',c:'Croatia',lat:43.5081,lng:16.4402},
    {n:'Valletta',c:'Malta',lat:35.8997,lng:14.5147},
    {n:'Beirut',c:'Lebanon',lat:33.8938,lng:35.5018},
    {n:'Casablanca',c:'Morocco',lat:33.5731,lng:-7.5898}
  ];
}
