// api/auth.js — Supabase auth handler for elsewhere
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-supabase-bypass-rls': 'true'
      }
    }
  }
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;

  try {
    // ── Send magic link ──────────────────────────────────────
    if (action === 'send_magic_link') {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email required' });

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: 'https://elsewhereastro.com/auth-callback.html'
        }
      });
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true });
    }

    // ── Save profile after magic link confirmed ───────────────
    if (action === 'save_profile') {
      const { user_id, email, name, birth_date, birth_time, birth_place, birth_lat, birth_lng } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user_id,
          email,
          name,
          birth_date,
          birth_time,
          birth_place,
          birth_lat,
          birth_lng
        }, { onConflict: 'id' });

      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true });
    }

    // ── Get profile ──────────────────────────────────────────
    if (action === 'get_profile') {
      const { user_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user_id)
        .maybeSingle();

      if (error) {
        console.error('get_profile error:', error);
        return res.status(400).json({ error: error.message, details: error });
      }
      return res.json({ profile: data });
    }

    // ── Save reading ─────────────────────────────────────────
    if (action === 'save_reading') {
      const { user_id, city_name, city_lat, city_lng } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      // Save the reading
      const { error: readingError } = await supabase
        .from('readings')
        .insert({ user_id, city_name, city_lat, city_lng });

      if (readingError) return res.status(400).json({ error: readingError.message });

      // Increment readings_used
      const { error: countError } = await supabase.rpc('increment_readings', { uid: user_id });
      if (countError) {
        // If RPC doesn't exist yet, do it manually
        await supabase
          .from('profiles')
          .update({ readings_used: supabase.raw('readings_used + 1') })
          .eq('id', user_id);
      }

      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
