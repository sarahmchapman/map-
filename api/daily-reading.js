// api/daily-reading.js — writes the day's horoscope from the daily engine
//
// The writing step of the app's daily horoscope (app/daily-horoscope-plan.md):
//   1. Works out who is asking from their sign-in token.
//   2. TESTING ONLY for now: the email must be listed in the DAILY_TESTERS
//      setting in Vercel, so nobody else can run up the AI bill.
//   3. Reads their birth details from their profile, converts the birth time
//      to world time (the same way the map and reports do).
//   4. Asks api/daily for today's influences at the place they are.
//   5. Sends the top influences to Claude, which writes the headline (the push
//      notification) and the short reading in the elsewhere voice. The
//      astrology comes only from the engine; the AI only writes it up.
//
//   POST /api/daily-reading   { "lat": 40.71, "lng": -74.01, "place": "New York",
//                               "zone": "America/New_York", "view": "today",
//                               "date": "2026-11-14" (local day; optional) }
//   view: today | tomorrow | week | month (the app's tabs)
//   header: Authorization: Bearer <Supabase access token>
//
// Env vars in Vercel: SUPABASE_URL, SUPABASE_SERVICE_KEY (already set),
//   ANTHROPIC_API_KEY (your Anthropic key), DAILY_TESTERS (emails allowed to
//   test, separated by commas), optional DAILY_MODEL (defaults below),
//   optional SITE_URL (defaults to https://elsewhereastro.com).

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const MODEL = process.env.DAILY_MODEL || 'claude-sonnet-5-5';
const GEONAMES_USER = process.env.GEONAMES_USER || 'sarahmchapman';   // same account the map uses
const SITE = (process.env.SITE_URL || 'https://elsewhereastro.com').replace(/\/$/, '');

// ── Birth time → world time (same as api/generate-report.js and js/app.js) ──
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
function tzFromLng(lng) { return Math.round(lng / 15); }
function tzOffsetFromZone(zone, y, mo, d, h, mi) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const offsetAt = ms => {
      const parts = {};
      fmt.formatToParts(new Date(ms)).forEach(p => { parts[p.type] = p.value; });
      const wallAsUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, (+parts.hour) % 24, +parts.minute);
      return Math.round((wallAsUTC - Math.floor(ms / 60000) * 60000) / 60000);
    };
    const wall = Date.UTC(y, mo - 1, d, h, mi);
    let off = offsetAt(wall);
    off = offsetAt(wall - off * 60000);
    if (isNaN(off)) return null;
    return off / 60;
  } catch (e) { return null; }
}
async function lookupBirthOffset(lat, lng, y, mo, d, h, mi) {
  const pad = n => String(n).padStart(2, '0');
  try {
    const url = 'https://secure.geonames.org/timezoneJSON?lat=' + Number(lat).toFixed(4) + '&lng=' + Number(lng).toFixed(4) +
      '&date=' + y + '-' + pad(mo) + '-' + pad(d) + '&username=' + GEONAMES_USER;
    const data = await (await fetch(url)).json();
    // Only trust a real time-zone answer. Guessing from longitude can put the
    // birth time an hour out, which moves every angle and house, so fail instead.
    const off = (data && data.timezoneId) ? tzOffsetFromZone(data.timezoneId, y, mo, d, h, mi) : null;
    return off;
  } catch (e) { return null; }
}
function jdFromDate(y, mo, d, h, mn) {
  if (mo <= 2) { y--; mo += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (mo + 1)) + d + h / 24 + mn / 1440 + B - 1524.5;
}
function parseBirthDate(s) {
  s = String(s || '').trim(); let m;
  if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/))) { const mo = MONTHS.indexOf(m[2].toLowerCase()) + 1; if (mo) return { y: +m[3], mo, d: +m[1] }; }
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return { y: +m[1], mo: +m[2], d: +m[3] };
  return null;
}
function parseBirthTime(s) {
  const m = String(s || '').trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? { h: +m[1], mi: +m[2] } : null;
}
async function birthJD(date, time, lat, lng) {
  const tz = await lookupBirthOffset(lat, lng, date.y, date.mo, date.d, time.h, time.mi);
  if (tz == null) return null;
  let utH = time.h - tz, utD = date.d;
  if (utH >= 24) { utH -= 24; utD++; } if (utH < 0) { utH += 24; utD--; }
  return jdFromDate(date.y, date.mo, utD, utH, time.mi);
}

// ── What the writer is told ─────────────────────────────────────────────
const HOUSES = {
  1: 'self, body, how you come across', 2: 'money, possessions, self-worth', 3: 'conversation, siblings, short trips, learning',
  4: 'home, family, roots', 5: 'romance, creativity, pleasure, children', 6: 'daily work, routines, health',
  7: 'partners, one-on-one relationships', 8: 'intimacy, shared money, transformation', 9: 'travel, study, beliefs',
  10: 'career, reputation, public life', 11: 'friends, community, hopes', 12: 'rest, solitude, the hidden and inner life'
};
const ANGLE_MEANING = {
  Ascendant: 'the relocated Ascendant (self, body, first impressions)', Descendant: 'the relocated Descendant (partners, close others)',
  MC: 'the relocated MC (career, reputation, public life)', IC: 'the relocated IC (home, family, roots)'
};

const VIEW_TEXT = {
  today: 'today', tomorrow: 'tomorrow', week: 'the next seven days', month: 'the next thirty days'
};

const SYSTEM = `You write the daily horoscope for elsewhere, an astrocartography app. Each reading is for one person, for the place they are, for one tab of the app: today, tomorrow, this week or this month.

Voice: short and to the point, warm, plain English, a little poetic but never vague. Second person ("you"). No filler, no exclamation marks, no emojis, no predictions of events, no medical, legal or money advice.

Rules you must follow:
- Write one short text for EACH influence given, in the same order, and nothing else. Never add other planets, aspects, signs or houses.
- Each text: one or two short sentences. Do not repeat the influence's name at the start; the app shows it above your text.
- Say where it lands using what is supplied: "lands_in" (a house of the chart for this place) or, for a relocated angle, "angle" (its meaning). Do not invent meanings.
- If only_here is true, say it only happens in this place (e.g. "Only happens in New York.").
- If at_birthplace is true, mention once, naturally, that this is where they were born, e.g. "in London, where you were born".
- Timing: for tab today/tomorrow, "exact at" items happen at that time of day; "in effect" items are the backdrop. For week/month, mention the key date from "timing" in the text (e.g. "exact Nov 17", "until Feb 15"). Never invent dates.
- "building": true means it is still getting stronger; false means it is easing. If retrograde is true, you may mention it.
- "tense": name the challenge kindly and give a way through. "easy": name the opening. "strong": intense, can go either way.
- Headline: 2 to 6 words, evocative, works as a phone notification on its own, led by the first influences.
- good_for and go_easy_on: two to four words each, drawn from the influences.

Reply with JSON only, no other text, in exactly this shape (texts has one entry per influence, same order):
{"headline": "...", "texts": ["...", "..."], "good_for": "...", "go_easy_on": "..."}

Example of the approved voice (New York, tab today):
{"headline": "Your energy goes home", "texts": ["A clear, bright mood this morning. In New York it lands in your 6th house of daily work, so start with the task that matters most.", "Only happens in New York. Mars is crossing the base of your chart here, the point of home and roots: energy for home projects or a move. It can stir tension at home if it has nowhere to go."], "good_for": "home plans, focused work", "go_easy_on": "snapping at housemates"}`;

function describe(f) {
  const angle = f.only_here ? ANGLE_MEANING[f.natal] : null;
  return {
    influence: `${f.transit} ${f.aspect} ${angle ? angle : 'natal ' + f.natal}`,
    when: f.when, timing: f.timing, tone: f.tone, retrograde: f.retrograde, only_here: f.only_here,
    building: f.building, span: f.span,
    ...(angle ? { angle } : {
      lands_in: `house ${f.transit_house}: ${HOUSES[f.transit_house]}`,
      natal_planet_house_here: f.natal_house ? `house ${f.natal_house}: ${HOUSES[f.natal_house]}` : null
    })
  };
}

// The name shown above each text, built from the engine (never from the AI).
const ASPECT_WORD = { conjunct: 'on', opposite: 'opposite', square: 'square', trine: 'trine', sextile: 'sextile' };
function titleOf(f) {
  const target = f.only_here ? 'your relocated ' + (f.natal === 'Ascendant' || f.natal === 'Descendant' ? f.natal : f.natal) : 'your ' + f.natal;
  return `${f.transit} ${ASPECT_WORD[f.aspect] || f.aspect} ${target}`;
}

// Pull the JSON object out of the AI's reply, forgiving code fences, curly
// quotes around keys and trailing commas.
function parseReply(text) {
  let s = String(text || '').replace(/```(?:json)?/gi, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a === -1 || b <= a) return null;
  s = s.slice(a, b + 1);
  const tries = [s, s.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1')];
  for (const t of tries) { try { return JSON.parse(t); } catch (e) { /* try the next */ } }
  return null;
}

async function askAI(facts) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2500, system: SYSTEM,
      messages: [{ role: 'user', content: 'Write this reading from these facts. Reply with the JSON object only, no code fences, no other text.\n' + JSON.stringify(facts, null, 2) }] })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('AI request failed: ' + ((j && j.error && j.error.message) || r.status));
  const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text || '').join('').trim();
  return { parsed: parseReply(text), text, usage: j.usage, model: j.model || MODEL, stop: j.stop_reason };
}

async function writeReading(place, view, dateLabel, daily, atBirthplace) {
  const items = daily.top || [];
  const facts = { place, tab: view, covers: VIEW_TEXT[view], date: dateLabel, at_birthplace: !!atBirthplace,
    house_system: daily.relocated && daily.relocated.house_system,
    influences: items.map(describe), retrograde: daily.retrograde };
  let last, usage = { input_tokens: 0, output_tokens: 0 }, model = MODEL;
  // One retry if the reply is not usable (wrong shape or wrong number of texts).
  for (let attempt = 0; attempt < 2; attempt++) {
    last = await askAI(facts);
    model = last.model;
    if (last.usage) { usage.input_tokens += last.usage.input_tokens || 0; usage.output_tokens += last.usage.output_tokens || 0; }
    const p = last.parsed;
    if (p && p.headline && Array.isArray(p.texts) && p.texts.length === items.length && p.texts.every(x => typeof x === 'string' && x.trim())) {
      // Everything except the wording comes from the engine.
      const influences = items.map((f, i) => ({
        title: titleOf(f), transit: f.transit, when: f.when, timing: f.timing, only_here: f.only_here,
        dates: f.dates, building: f.building, exact_here: f.when === 'today' || f.when === 'tomorrow' || !!f.exact_here, text: p.texts[i].trim()
      }));
      return { reading: { headline: String(p.headline).trim(), influences, good_for: p.good_for || '', go_easy_on: p.go_easy_on || '' }, usage, model };
    }
  }
  const e = new Error('AI reply was not usable (stop: ' + (last && last.stop) + ')');
  e.raw = last && last.text ? last.text.slice(0, 1500) : '';
  throw e;
}

// ── Handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const lat = Number(body.lat), lng = Number(body.lng);
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      return res.status(400).json({ error: 'lat and lng are required' });
    const place = String(body.place || 'here').replace(/[^\p{L}\p{M}\s,.'-]/gu, '').trim().slice(0, 60) || 'here';
    const view = ['today', 'tomorrow', 'week', 'month'].includes(body.view) ? body.view : 'today';
    const zone = String(body.zone || '');
    try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); } catch (e) { return res.status(400).json({ error: 'zone (time zone name) is required' }); }
    if (!zone) return res.status(400).json({ error: 'zone (time zone name) is required' });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || '')) ? String(body.date) : null;

    // 1. Who is asking
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'not_signed_in' });
    const { data: u, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !u || !u.user || !u.user.email) return res.status(401).json({ error: 'not_signed_in' });
    const email = u.user.email.toLowerCase();
    const userId = u.user.id;

    // 2. Testers only, for now
    const testers = String(process.env.DAILY_TESTERS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    if (!testers.includes(email)) return res.status(403).json({ error: 'not_a_tester' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set in Vercel' });

    // 3. Birth details
    const { data: p, error: prErr } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (prErr) return res.status(500).json({ error: 'Could not read profile: ' + prErr.message });
    const bdate = p && parseBirthDate(p.birth_date), time = p && parseBirthTime(p.birth_time);
    const blat = p && Number(p.birth_lat), blng = p && Number(p.birth_lng);
    if (!p || !bdate || !time || !isFinite(blat) || !isFinite(blng) || p.birth_lat == null || p.birth_lng == null)
      return res.status(422).json({ error: 'birth_details_incomplete' });
    const jd = await birthJD(bdate, time, blat, blng);
    if (jd == null) return res.status(503).json({ error: 'birth_time_lookup_failed', message: 'Could not look up the time zone of your birthplace. Please try again in a minute.' });

    // 4. Today's influences here
    const q = `jd=${jd}&lat=${lat}&lng=${lng}&zone=${encodeURIComponent(zone)}&view=${view}` + (date ? `&date=${date}` : '');
    const dr = await fetch(`${SITE}/api/daily?${q}`);
    const daily = await dr.json();
    if (!dr.ok) return res.status(500).json({ error: 'Daily engine failed: ' + (daily && daily.error) });

    // 5. Write it up
    // Within 50 km of the birthplace: the relocated chart is the birth chart.
    const toRad = x => x * Math.PI / 180;
    const km = 6371 * Math.acos(Math.min(1, Math.sin(toRad(lat)) * Math.sin(toRad(blat)) +
      Math.cos(toRad(lat)) * Math.cos(toRad(blat)) * Math.cos(toRad(lng - blng))));
    const { reading, usage, model } = await writeReading(place, view, daily.date, daily, km < 50);
    return res.status(200).json({ place, view, date: daily.date, house_system: daily.relocated.house_system,
      reading, model, usage });
  } catch (err) {
    console.error('daily-reading failed:', err);
    return res.status(500).json({ error: 'daily-reading failed: ' + err.message, raw: err.raw });
  }
}
