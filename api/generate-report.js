// api/generate-report.js — makes (or loads) a buyer's Best Places report
//
// The report page calls this with the buyer's sign-in token and a theme:
//   POST /api/generate-report   { "theme": "love" | "career" | "home" }
//   header: Authorization: Bearer <Supabase access token>
//
// What it does, in order:
//   1. Works out who is asking from their sign-in token (never trusts an
//      email sent by the browser).
//   2. Checks the purchases table: they must have paid for this report
//      (report_<theme>) or for all three (report_all).
//   3. Reads their birth details from their profile.
//   4. If a saved report exists for the same birth details and engine
//      version, returns it straight away.
//   5. Otherwise: converts the local birth time to world time (the same way
//      the map does), asks api/report-chart for the chart data in slices,
//      runs the approved engine (api/_lib/reports), saves every report they have
//      paid for in place_reports, and returns the one asked for.
//
// Env vars (already set in Vercel): SUPABASE_URL, SUPABASE_SERVICE_KEY

import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const CITIES = require('./cities_world.json');   // same list api/report-chart.py uses
// Make sure Vercel bundles the engine files with this function.
require.resolve('./_lib/reports/engine.js');
require.resolve('./_lib/reports/rank.cjs');
require.resolve('./_lib/reports/report.cjs');

export const ENGINE_VERSION = 'reports engine approved Nov 1, 2026 (speed fix Nov 8)';
const THEMES = ['love', 'career', 'home'];
const SLICES = 8;   // the city list is fetched in 8 parts so each stays under Vercel's 4.5 MB limit
const GEONAMES_USER = 'sarahmchapman';   // same account the map uses

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

// ── Birth time → world time (copied from js/app.js so reports use the same moment as the map) ──
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
// "7 December 1994" (how profiles store it) or "1994-12-07"
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
export async function birthJD(date, time, lat, lng) {
  const tz = await lookupBirthOffset(lat, lng, date.y, date.mo, date.d, time.h, time.mi);
  // Same arithmetic as _buildChart in js/app.js.
  let utH = time.h - tz, utD = date.d;
  if (utH >= 24) { utH -= 24; utD++; } if (utH < 0) { utH += 24; utD--; }
  return { jd: jdFromDate(date.y, date.mo, utD, utH, time.mi), tz };
}

// ── Chart data from api/report-chart, in slices, joined back up ──────────
export async function fetchChart(base, jd, lat, lng, fetchSlice) {
  const n = CITIES.length, size = Math.ceil(n / SLICES);
  const get = fetchSlice || (async (start, end) => {
    const r = await fetch(`${base}/api/report-chart?jd=${jd}&lat=${lat}&lng=${lng}&start=${start}&end=${end}`);
    const j = await r.json();
    if (!r.ok || j.error) throw new Error('report-chart: ' + (j.error || r.status));
    return j;
  });
  const parts = await Promise.all(Array.from({ length: SLICES }, (_, i) => get(i * size, Math.min(n, (i + 1) * size))));
  const first = parts[0];
  if (first.cities.total !== n) throw new Error(`city lists differ (${first.cities.total} vs ${n}); redeploy both files`);
  const cities = [];
  for (const part of parts) {
    const C = part.cities;
    for (let i = 0; i < C.count; i++) {
      const ct = CITIES[C.start + i], row = C.dist[i], dist = {};
      part.bodies.forEach((b, bi) => { dist[b] = {}; part.angles.forEach((a, ai) => { dist[b][a] = row[bi * part.angles.length + ai]; }); });
      cities.push({ ...ct, cusps: C.cusps[i], asc: C.asc[i], mc: C.mc[i], dist });
    }
  }
  return { jd: first.jd, gmst: first.gmst, planets: first.planets, natal: first.natal, parans: first.parans, cities };
}

// ── Run the approved engine ──────────────────────────────────────────────
export function buildReports(chart, opts) {
  // Load the engine fresh each time, so wording that rotates between places
  // starts from the same point for every buyer (as it did when approved).
  for (const k of Object.keys(require.cache)) if (/_lib[\\/]reports[\\/]/.test(k)) delete require.cache[k];
  const R = require('./_lib/reports/rank.cjs');
  const { build } = require('./_lib/reports/report.cjs');
  const all = R.rankAll(chart);
  const out = {}; for (const t of THEMES) out[t] = build(chart, t, opts, all);
  return out;
}

// ── The endpoint ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const theme = body.theme;
  if (!THEMES.includes(theme)) return res.status(400).json({ error: 'theme must be love, career or home' });

  // 1. Who is asking
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'not_signed_in' });
  const { data: u, error: uErr } = await supabase.auth.getUser(token);
  if (uErr || !u || !u.user || !u.user.email) return res.status(401).json({ error: 'not_signed_in' });
  const email = u.user.email.toLowerCase();

  // 2. Have they paid for it?
  const { data: buys, error: pErr } = await supabase.from('purchases').select('product')
    .eq('email', email).eq('status', 'paid').in('product', ['report_' + theme, 'report_all']);
  if (pErr) return res.status(500).json({ error: 'Could not check purchases: ' + pErr.message });
  if (!buys || !buys.length) return res.status(402).json({ error: 'not_purchased', theme });
  const { data: allBuys } = await supabase.from('purchases').select('product').eq('email', email).eq('status', 'paid');
  const paid = new Set(THEMES.filter(t => (allBuys || []).some(b => b.product === 'report_' + t || b.product === 'report_all')));

  // 3. Birth details
  const { data: profs, error: prErr } = await supabase.from('profiles').select('*').eq('email', email).order('created_at', { ascending: false }).limit(1);
  if (prErr) return res.status(500).json({ error: 'Could not read profile: ' + prErr.message });
  const p = profs && profs[0];
  if (!p) return res.status(422).json({ error: 'no_profile' });
  const date = parseBirthDate(p.birth_date), time = parseBirthTime(p.birth_time);
  const lat = Number(p.birth_lat), lng = Number(p.birth_lng);
  if (!date || !time || !isFinite(lat) || !isFinite(lng) || p.birth_lat == null || p.birth_lng == null)
    return res.status(422).json({ error: 'birth_details_incomplete', missing: { date: !date, time: !time, place: !isFinite(lat) || !isFinite(lng) } });
  const birthKey = [p.birth_date, p.birth_time, lat, lng].join('|');

  // 4. Already made?
  const { data: saved } = await supabase.from('place_reports').select('report, birth_key, engine_version')
    .eq('email', email).eq('theme', theme).limit(1);
  if (saved && saved[0] && saved[0].birth_key === birthKey && saved[0].engine_version === ENGINE_VERSION)
    return res.status(200).json({ report: saved[0].report, cached: true });

  // 5. Make it
  try {
    const t0 = Date.now();
    const { jd } = await birthJD(date, time, lat, lng);
    const base = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const chart = await fetchChart(base, jd, lat, lng);
    const t1 = Date.now();
    const name = (p.name || '').trim();
    const opts = { name: name ? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() : '',
      birth: `${p.birth_date} · ${p.birth_time} · ${p.birth_place || ''}`.trim(),
      blat: lat, blng: lng, bname: (p.birth_place || '').split(',')[0] };
    const reports = buildReports(chart, opts);
    const t2 = Date.now();
    const rows = [...paid].map(t => ({ email, theme: t, report: reports[t], birth_key: birthKey, engine_version: ENGINE_VERSION }));
    const { error: sErr } = await supabase.from('place_reports').upsert(rows, { onConflict: 'email,theme' });
    if (sErr) console.error('Could not save reports:', sErr.message);   // still show the report
    console.log(`generate-report ${email} ${theme}: chart ${t1 - t0} ms, engine ${t2 - t1} ms`);
    return res.status(200).json({ report: reports[theme], cached: false, timing: { chartMs: t1 - t0, engineMs: t2 - t1 } });
  } catch (err) {
    console.error('generate-report failed:', err);
    return res.status(500).json({ error: 'Could not make the report: ' + err.message });
  }
}
