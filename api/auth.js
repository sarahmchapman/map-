// api/auth.js — Supabase auth handler for elsewhere
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

    // ── Claim a purchase: create the buyer's account ─────────
    // Used by success.html when someone pays without being signed in.
    // We check with Stripe that this checkout really was paid, take the
    // email it was paid with (the same email the webhook files the
    // purchase under), and create an account with the password they chose.
    // If an account already exists for that email we change nothing and
    // tell the page, which then asks them to sign in instead.
    if (action === 'claim_purchase') {
      const { session_id, password } = req.body;
      if (typeof session_id !== 'string' || !session_id.startsWith('cs_')) {
        return res.status(400).json({ error: 'Missing purchase details. Please use the link from your checkout.' });
      }
      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Please choose a password of at least 8 characters.' });
      }

      let session;
      try {
        session = await stripe.checkout.sessions.retrieve(session_id);
      } catch (e) {
        return res.status(400).json({ error: 'We could not find that purchase.' });
      }
      if (!session || session.payment_status !== 'paid') {
        return res.status(402).json({ error: 'This purchase has not been paid.' });
      }

      const email = (
        (session.customer_details && session.customer_details.email) ||
        session.customer_email || ''
      ).toLowerCase();
      if (!email) return res.status(400).json({ error: 'No email was recorded with this purchase.' });

      const { error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (error) {
        if (/already|registered|exists/i.test(error.message)) return res.json({ exists: true, email });
        return res.status(400).json({ error: error.message });
      }
      return res.json({ created: true, email });
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
