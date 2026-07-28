// api/check-access.js — "has this person paid?" check
//
// The shared access question, answered SERVER-SIDE using the service key
// (which the browser never sees). Given an email, it returns whether that
// email has a paid Map Guide purchase in the purchases table.
//
// Used by:
//   - profile.html  → show "Map Guide — purchased ✓" + link to the report
//   - report.html   → gate access (show report only if paid)
//   - map-guide.html (optional) → show "you already own this" to buyers
//
// The email comes from the caller's logged-in Supabase session. This
// endpoint just answers the yes/no; it does not itself verify the session
// (the client passes the session's email). For a client-side gate at this
// price point that is sufficient — see project notes on the practical vs.
// server-rendered security tradeoff.
//
// Env vars used (already set in Vercel):
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, product } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'email required' });
  }

  // Which product to check for. Defaults to map_guide; future best-places
  // reports can pass their own product value against the same table.
  const wantProduct = product || 'map_guide';

  try {
    const { data, error } = await supabase
      .from('purchases')
      .select('id, product, status, created_at')
      .eq('email', email.toLowerCase())   // purchases are stored lowercased
      .eq('product', wantProduct)
      .eq('status', 'paid')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('check-access lookup error:', error.message);
      return res.status(500).json({ error: 'lookup failed' });
    }

    // hasAccess is true only if a matching paid row exists.
    return res.status(200).json({
      hasAccess: !!data,
      product: wantProduct,
      since: data ? data.created_at : null
    });
  } catch (ex) {
    console.error('check-access crashed:', ex.message);
    return res.status(500).json({ error: 'server error' });
  }
}
