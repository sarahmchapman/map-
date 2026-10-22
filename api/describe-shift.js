// api/describe-shift.js — "What changes" text for a relocated house shift
//
// On the reading page ("Dive Deeper"), a planet can move from one house at
// the birthplace to another house in the chosen city. Twelve of those moves
// (mostly to the opposite house) have hand-written "What changes" texts in
// reading.html. This endpoint covers the other 120: written by Claude on
// first request, in the same voice, then cached in Supabase so every later
// request is instant and free.
//
// Mirrors api/describe-planet.js and api/describe-aspect.js: same cache
// table, same generate-on-miss-then-cache flow, same fallback safety.
//
//   POST { from: 5, to: 7 }  ->  { paragraph, source: 'cache'|'generated'|'fallback' }
//
// The text is about the move between two houses, not a particular planet
// (the planet's own story is told in the two paragraphs above it on the
// card), so one cached text serves every planet making that move.
// Cache key: shift:<from>:<to>   (132 possible; 120 generated at most)

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Same short house descriptions the reading page uses.
const HOUSES = {
  1:  'self, identity, and how you show up in the world',
  2:  'personal resources, money, and what you value',
  3:  'communication, local community, and everyday life',
  4:  'home, family, roots, and private life',
  5:  'creativity, pleasure, romance, and self-expression',
  6:  'daily routine, health, and how you work',
  7:  'relationships, partnership, and how you connect with others',
  8:  'transformation, shared resources, intimacy, and what lies beneath the surface',
  9:  'expansion, travel, philosophy, and belief',
  10: 'career, reputation, and how the world sees you',
  11: 'community, friendships, and long-term vision',
  12: 'solitude, the unconscious, and what is hidden'
};

// ── Voice anchors ───────────────────────────────────────────────
// Sarah's hand-written "What changes" texts from reading.html.
const VOICE_EXAMPLES = `
Example — 1st house → 7th house:
This is a shift from self to other. At your birthplace your energy naturally goes toward defining who you are — here that energy moves toward partnership and connection. You may find yourself more relationship focused, more aware of how you show up for others. The challenge is not losing yourself in the process.

Example — 2nd house → 8th house:
At home you build your own security — here that energy moves into shared territory. Money, intimacy, and power dynamics with others become more prominent. This can be deeply transformative, but it asks you to trust and to let go of full control.

Example — 9th house → 3rd house:
Your world gets more local here. The expansive, philosophical energy of your birthplace narrows into something more immediate — your neighbourhood, your daily conversations, your close community. That's not a limitation, it's a different kind of richness.

Example — 10th house → 4th house:
This is a shift toward private life. The ambition and public energy of your birthplace softens here into something more domestic and inward. This place may not be where your career thrives, but it could be where you finally feel at home.

Example — 6th house → 12th house:
This is a quieting shift. The structured, productive energy of your birthplace softens into something more inward and less defined here. This can feel disorienting if you're used to routine, but it can also be deeply restorative.

Example — 12th house → 1st house:
This is one of the most activating shifts possible. The quiet, inward energy of your birthplace steps fully into the light here. You become more visible, more present, more yourself in public. For people with a 12th house placement natally this can feel like finally arriving.
`.trim();

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function buildPrompt(from, to) {
  return `You write short paragraphs for an astrocartography reading. A planet in the reader's chart sits in the ${ordinal(from)} house at their birthplace (${HOUSES[from]}), and moves into the ${ordinal(to)} house in the city they are looking at (${HOUSES[to]}).

Write ONE paragraph (3-4 sentences, 45-70 words) titled "What changes", describing what this move from the ${ordinal(from)} house to the ${ordinal(to)} house feels like, in the same voice as the examples below. The paragraph should:

- Describe the move in concrete, lived terms: where the energy goes at the birthplace, and where it goes here.
- Be honest about both the gift and the cost of the move. Don't oversell it.
- Speak to "you", and refer to the two places as "your birthplace" (or "at home") and "here" (or "this place" / "this city").
- NEVER name a planet or a zodiac sign: the same text is shown for every planet making this move.
- Stay in plain English with British-leaning spelling as in the examples; no jargon, no "natives", no mystical phrasing.

${VOICE_EXAMPLES}

Now write the paragraph for the ${ordinal(from)} house → ${ordinal(to)} house. Output only the paragraph itself — no preamble, no heading.`;
}

function fallbackParagraph(from, to) {
  return `At your birthplace this part of your chart works through ${HOUSES[from]}. Here it moves toward ${HOUSES[to]}.`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Validate: two different houses, 1–12 ──────────────────────
  const from = parseInt((req.body || {}).from, 10);
  const to = parseInt((req.body || {}).to, 10);
  if (!(from >= 1 && from <= 12) || !(to >= 1 && to <= 12) || from === to) {
    return res.status(400).json({ error: 'from and to must be different houses, 1-12' });
  }
  const cacheKey = `shift:${from}:${to}`;

  // ── Step 1: cache ─────────────────────────────────────────────
  try {
    const { data: cached, error: cacheErr } = await supabase
      .from('description_cache')
      .select('content')
      .eq('cache_key', cacheKey)
      .maybeSingle();
    if (cacheErr) console.error('Cache lookup error:', cacheErr.message);
    if (cached && cached.content) {
      return res.status(200).json({ from, to, paragraph: cached.content, source: 'cache' });
    }
  } catch (ex) {
    console.error('Cache layer crashed:', ex.message);
  }

  // ── Step 2: generate ──────────────────────────────────────────
  let paragraph;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: buildPrompt(from, to) }]
    });
    paragraph = response.content[0].text.trim();
  } catch (ex) {
    console.error('Claude generation failed:', ex.message);
    return res.status(200).json({ from, to, paragraph: fallbackParagraph(from, to), source: 'fallback', error: ex.message });
  }

  // ── Step 3: cache it (best-effort) ────────────────────────────
  try {
    const { error: insertErr } = await supabase
      .from('description_cache')
      .insert({ cache_key: cacheKey, content: paragraph });
    if (insertErr) console.warn('Cache insert error:', insertErr.message);
  } catch (ex) {
    console.warn('Cache insert crashed:', ex.message);
  }

  return res.status(200).json({ from, to, paragraph, source: 'generated' });
}
