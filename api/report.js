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

// ── Category planet mappings ──────────────────────────────────
const CATEGORY_PLANETS = {
  Love:    ['Venus', 'Moon', 'Neptune', 'Jupiter'],
  Career:  ['Saturn', 'Sun', 'Mars', 'Jupiter'],
  Healing: ['Chiron', 'Moon', 'Neptune', 'Venus']
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
function scoreCity(city, acgLines, parans, categoryPlanets, planets) {
  let score = 0;
  const activations = [];

  // 1. Check line distances for category planets
  for (const planet of categoryPlanets) {
    const lines = acgLines[planet];
    if (!lines) continue;

    for (const lt of ['MC', 'IC', 'ASC', 'DSC']) {
      const pts = lines[lt];
      if (!pts) continue;
      const dist = distToLine(city.lat, city.lng, pts);

      if (dist < 2) {
        const strength = dist < 0.5 ? 'exact' : dist < 1 ? 'strong' : 'moderate';
        score += (3 - dist) * 10;
        activations.push({ planet, lineType: lt, dist, strength, type: 'line' });
      }
    }
  }

  // 2. Check parans at this latitude (using accurate server-calculated parans)
  for (const paran of parans) {
    const latDiff = Math.abs(city.lat - paran.latitude);
    if (latDiff < 3) {
      const p1 = paran.planet1;
      const p2 = paran.planet2;
      // Check if either planet is a category planet
      const relevant = categoryPlanets.includes(p1) || categoryPlanets.includes(p2);
      if (relevant) {
        // Stronger score for tighter orb
        const paranScore = (3 - latDiff) * (1 - paran.orb) * 8;
        score += paranScore;
        activations.push({
          planet1: p1,
          planet2: p2,
          line1: paran.line1,
          line2: paran.line2,
          latitude: paran.latitude,
          longitude: paran.longitude,
          latDiff,
          orb: paran.orb,
          type: 'paran'
        });
      }
    }
  }

  return { score, activations };
}

// ── Compute house number from longitude ───────────────────────
function getHouse(planetLon, ascLon) {
  const rel = ((planetLon - ascLon) % 360 + 360) % 360;
  return Math.floor(rel / 30) + 1;
}

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
        city, acgLines, parans, categoryPlanets, planets
      );
      return { city, score, activations };
    }).filter(c => c.score > 0 && c.activations.length > 0);

    // Sort by score, take top 3
    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3);

    if (top3.length === 0) {
      return res.status(200).json({
        report: null,
        message: 'No strong activations found for this category.'
      });
    }

    // Build relocated chart context for each city
    // We pass the natal planets + house shifts as context for Claude
    const cityContexts = top3.map(({ city, activations }) => {
      // Compute approximate house shifts using ASC longitude change
      const natalAscLon = planets.Ascendant?.totalDeg || 0;
      // Estimate new ASC from the MC line longitude if available
      let relocAscApprox = natalAscLon;
      const mcLine = acgLines['Sun']?.MC;
      if (mcLine && mcLine.length > 0) {
        // Find point closest to city latitude
        let closest = mcLine[0];
        let minDist = 999;
        for (const pt of mcLine) {
          const d = Math.abs(pt[0] - city.lat);
          if (d < minDist) { minDist = d; closest = pt; }
        }
        // Approximate ASC shift based on city longitude difference from birth
        const lngDiff = city.lng - birthLng;
        relocAscApprox = n360(natalAscLon + lngDiff);
      }

      // Calculate house shifts for key planets
      const houseShifts = {};
      const keyPlanets = [...new Set([...categoryPlanets, 'Sun', 'Moon'])];
      for (const p of keyPlanets) {
        const pd = planets[p];
        if (!pd || pd.totalDeg == null) continue;
        const natalHouse = getHouse(pd.totalDeg, natalAscLon);
        const relocHouse = getHouse(pd.totalDeg, relocAscApprox);
        if (natalHouse !== relocHouse) {
          houseShifts[p] = { from: natalHouse, to: relocHouse };
        }
      }

      // Format activations for readability
      const lineActivations = activations
        .filter(a => a.type === 'line')
        .map(a => `${a.planet} ${a.lineType} line (${a.strength} — ${a.dist.toFixed(1)}°)`)
        .join(', ');

      const paranActivations = activations
        .filter(a => a.type === 'paran')
        .map(a => `${a.planet1}/${a.planet2} paran at ${a.latitude.toFixed(1)}°N/S latitude`)
        .join(', ');

      const houseShiftText = Object.entries(houseShifts)
        .map(([p, s]) => `${p}: ${s.from}th → ${s.to}th house`)
        .join(', ');

      return {
        cityName: `${city.n}, ${city.c}`,
        lat: city.lat,
        lng: city.lng,
        lineActivations,
        paranActivations,
        houseShifts: houseShiftText,
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

USER'S BIRTH DATA:
- Name: ${name || 'the user'}
- Birth: ${birthDate} at ${birthTime}
- Birthplace: ${birthPlace}
- Natal chart: ${natalContext}
- Relevant aspects: ${relevantAspects || 'none within orb'}

TOP 3 CITIES FOR ${category.toUpperCase()}:

${cityContexts.map((ctx, i) => `
${i + 1}. ${ctx.cityName}
   Lines activated: ${ctx.lineActivations || 'none'}
   Parans: ${ctx.paranActivations || 'none'}
   House shifts from natal: ${ctx.houseShifts || 'minimal'}
`).join('')}

Write a ${category} report with this exact structure:

---INTRO---
2-3 sentences introducing what ${category.toLowerCase()} looks like in this person's natal chart specifically. Reference their actual placements and aspects. What is the quality of their ${category.toLowerCase()} energy at their birthplace?

---CITY 1: ${cityContexts[0]?.cityName}---
A full, rich reading of what ${category.toLowerCase()} means for this specific person in this specific city. Minimum 150 words. Reference:
- Which lines are active and what they mean
- Any parans and what the combined planetary energy creates
- How the house shifts change the expression of their ${category.toLowerCase()} energy
- What life could actually feel like here for them
- Be honest about challenges as well as gifts

---CITY 2: ${cityContexts[1]?.cityName}---
Same depth as City 1. Minimum 150 words. Make it feel completely different from City 1.

---CITY 3: ${cityContexts[2]?.cityName}---
Same depth as City 1 and 2. Minimum 150 words. Make it feel completely different from the others.

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
