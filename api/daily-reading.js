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
//                               "day": "Thursday", "at": <optional jd UT> }
//   header: Authorization: Bearer <Supabase access token>
//
// Env vars in Vercel: SUPABASE_URL, SUPABASE_SERVICE_KEY (already set),
//   ANTHROPIC_API_KEY (your Anthropic key), DAILY_TESTERS (emails allowed to
//   test, separated by commas), optional DAILY_MODEL (defaults below).

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const MODEL = process.env.DAILY_MODEL || 'claude-sonnet-5-5';
const GEONAMES_USER = 'sarahmchapman';   // same account the map uses

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
    let off = (data && data.timezoneId) ? tzOffsetFromZone(data.timezoneId, y, mo, d, h, mi) : null;
    if (off == null) {
      const raw = (data && data.rawOffset != null) ? data.rawOffset : tzFromLng(lng);
      const dst = (data && data.dstOffset != null) ? data.dstOffset : raw;
      off = (mo >= 4 && mo <= 10 && dst !== raw) ? dst : raw;
    }
    return off;
  } catch (e) { return tzFromLng(lng); }
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

const SYSTEM = `You write the daily horoscope for elsewhere, an astrocartography app. Each reading is for one person, for the place they are today.

Voice: short and to the point, warm, plain English, a little poetic but never vague. Second person ("you"). No filler, no exclamation marks, no emojis, no predictions of events, no medical, legal or money advice.

Rules you must follow:
- Use ONLY the influences given. Never add other planets, aspects, signs or houses.
- Name each influence as given, e.g. "Mercury on your Venus" for a conjunction, "Venus trine your Moon", "Mars on your relocated IC".
- Say where it lands using the house given for this place (the meaning is supplied). Do not invent house meanings.
- If an influence is marked only_here, say it only happens in this place (e.g. "only happens in New York").
- Keep the influences in the order given (today first) and write every one of them.
- Copy each influence's "when" (today / this week / this month / this season) and "timing" exactly into your reply. For this month and this season influences, the text must also mention the dates from "timing" (e.g. "until Feb 15, exact again Jan 23"). For today, you may mention the time.
- If at_birthplace is true, mention once, naturally, that this is where they were born (their birth chart's own angles), e.g. "in London, where you were born". It still only happens here.
- If the planet is retrograde, you may mention it.
- "tense" influences: name the challenge kindly and give a way through. "easy": name the opening. "strong": intense, can go either way.
- Headline: 2 to 6 words, evocative, works as a phone notification on its own.
- Each influence: one or two short sentences. The headline should reflect today's influences first.
- good_for and go_easy_on: two to four words each, drawn from the influences.

Reply with JSON only, no other text, in exactly this shape:
{"headline": "...", "influences": [{"title": "...", "when": "...", "timing": "...", "only_here": true|false, "text": "..."}], "good_for": "...", "go_easy_on": "..."}

Example of the approved voice (New York):
{"headline": "Your energy goes home", "influences": [{"title": "Moon on your Sun", "when": "today", "timing": "exact today at 10:25 am", "only_here": false, "text": "A clear, bright mood this morning. In New York it lands in your 6th house of daily work, so start the day on the task that matters most."}, {"title": "Mars on your relocated IC", "when": "this week", "timing": "exact Nov 9, in effect Nov 6 to Nov 13", "only_here": true, "text": "Only happens in New York. Mars is crossing the base of your chart here, the point of home and roots: energy for home projects or a move, until Nov 13. It can stir tension at home if it has nowhere to go."}, {"title": "Jupiter on your relocated IC", "when": "this month", "timing": "Oct 4 to Nov 17; exact Oct 22", "only_here": true, "text": "Only happens in New York. Growth and good fortune around home and roots, until Nov 17."}], "good_for": "home plans, focused work", "go_easy_on": "snapping at housemates"}`;

function describe(f) {
  const angle = ANGLE_MEANING[f.natal];
  const target = angle ? angle : `natal ${f.natal}`;
  return {
    influence: `${f.transit} ${f.aspect} ${target}`,
    when: f.when, timing: f.timing, tone: f.tone, retrograde: f.retrograde, only_here: f.only_here,
    lands_in: `house ${f.transit_house}: ${HOUSES[f.transit_house]}`,
    natal_planet_house_here: f.natal_house ? `house ${f.natal_house}: ${HOUSES[f.natal_house]}` : null
  };
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

async function writeReading(place, day, daily, atBirthplace) {
  const facts = { place, day, at_birthplace: !!atBirthplace, influences: (daily.top || []).map(describe), retrograde_today: daily.retrograde_today };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2500, system: SYSTEM,
      messages: [{ role: 'user', content: 'Write today\'s reading from these facts. Reply with the JSON object only, no code fences, no other text.\n' + JSON.stringify(facts, null, 2) }] })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('AI request failed: ' + ((j && j.error && j.error.message) || r.status));
  const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text || '').join('').trim();
  const reading = parseReply(text);
  if (!reading) {
    const e = new Error('AI reply was not valid JSON (stop: ' + j.stop_reason + ')');
    e.raw = text.slice(0, 1500);
    throw e;
  }
  if (!reading.headline || !Array.isArray(reading.influences)) throw new Error('AI reply was missing parts');
  return { reading, usage: j.usage, model: j.model || MODEL };
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
    const place = String(body.place || 'here').slice(0, 60);
    const day = String(body.day || '').slice(0, 20);

    // 1. Who is asking
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'not_signed_in' });
    const { data: u, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !u || !u.user || !u.user.email) return res.status(401).json({ error: 'not_signed_in' });
    const email = u.user.email.toLowerCase();

    // 2. Testers only, for now
    const testers = String(process.env.DAILY_TESTERS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    if (!testers.includes(email)) return res.status(403).json({ error: 'not_a_tester' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set in Vercel' });

    // 3. Birth details
    const { data: profs, error: prErr } = await supabase.from('profiles').select('*').eq('email', email).order('created_at', { ascending: false }).limit(1);
    if (prErr) return res.status(500).json({ error: 'Could not read profile: ' + prErr.message });
    const p = profs && profs[0];
    const date = p && parseBirthDate(p.birth_date), time = p && parseBirthTime(p.birth_time);
    const blat = p && Number(p.birth_lat), blng = p && Number(p.birth_lng);
    if (!p || !date || !time || !isFinite(blat) || !isFinite(blng) || p.birth_lat == null || p.birth_lng == null)
      return res.status(422).json({ error: 'birth_details_incomplete' });
    const jd = await birthJD(date, time, blat, blng);

    // 4. Today's influences here
    const base = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const tz = isFinite(Number(body.tz)) ? Math.max(-14, Math.min(14, Number(body.tz))) : 0;
    const q = `jd=${jd}&lat=${lat}&lng=${lng}&tz=${tz}` + (isFinite(Number(body.at)) && body.at ? `&at=${Number(body.at)}` : '');
    const dr = await fetch(`${base}/api/daily?${q}`);
    const daily = await dr.json();
    if (!dr.ok) return res.status(500).json({ error: 'Daily engine failed: ' + (daily && daily.error) });

    // 5. Write it up
    // Within 50 km of the birthplace: the relocated chart is the birth chart.
    const toRad = x => x * Math.PI / 180;
    const km = 6371 * Math.acos(Math.min(1, Math.sin(toRad(lat)) * Math.sin(toRad(blat)) +
      Math.cos(toRad(lat)) * Math.cos(toRad(blat)) * Math.cos(toRad(lng - blng))));
    const { reading, usage, model } = await writeReading(place, day, daily, km < 50);
    return res.status(200).json({ place, day, reading, engine: daily.top, model, usage });
  } catch (err) {
    console.error('daily-reading failed:', err);
    return res.status(500).json({ error: 'daily-reading failed: ' + err.message, raw: err.raw });
  }
}
