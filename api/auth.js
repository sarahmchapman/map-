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

// A table that doesn't exist in this project can hold no rows, so a delete
// against it is nothing to worry about. Postgres reports that as 42P01.
function isMissingTable(err) {
  if (!err) return false;
  if (err.code === '42P01') return true;
  return /does not exist|could not find the table|schema cache/i.test(err.message || '');
}

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

    // ── Delete account ───────────────────────────────────────
    // Apple requires an in-app way to delete an account, and our privacy
    // policy promises it. Unlike the actions above, this one does NOT trust
    // a user_id sent by the browser: anyone could post someone else's id and
    // erase their account. Instead we work out who is asking from their
    // sign-in token, the same way api/generate-report.js does.
    //
    // Purchase records are deliberately kept. They are the sales record we
    // need for tax, and the privacy policy says so. A person who deletes
    // their account and later signs up again with the same email will find
    // what they bought still unlocked.
    //
    // Order matters. Rows that depend on the account go first and the auth
    // record goes last, so a failure partway leaves the account intact and
    // the person can simply try again. Deleting the auth record first would
    // strand the remaining rows with no signed-in user able to reach them.
    if (action === 'delete_account') {
      const { confirm } = req.body;

      // A second, independent guard: even a valid token cannot delete an
      // account unless the request plainly says so.
      if (confirm !== 'DELETE') {
        return res.status(400).json({ error: 'Please type DELETE to confirm.' });
      }

      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return res.status(401).json({ error: 'Please sign in again and retry.' });

      const { data: u, error: uErr } = await supabase.auth.getUser(token);
      if (uErr || !u || !u.user || !u.user.id) {
        return res.status(401).json({ error: 'Please sign in again and retry.' });
      }

      const userId = u.user.id;
      const email = (u.user.email || '').toLowerCase();

      // 1. Saved Best Places reports (keyed by email).
      if (email) {
        const { error: repErr } = await supabase.from('place_reports').delete().eq('email', email);
        if (repErr && !isMissingTable(repErr)) {
          console.error('delete_account place_reports:', repErr.message);
          return res.status(500).json({ error: 'Could not delete your saved reports. Nothing was removed; please try again.', reason: repErr.message });
        }
        if (repErr) console.log('delete_account: no place_reports table, skipping');
      }

      // 2. Saved readings (keyed by user id).
      // If this table doesn't exist in this project, there is nothing to
      // delete and no reason to block the account deletion over it.
      const { error: readErr } = await supabase.from('readings').delete().eq('user_id', userId);
      if (readErr && !isMissingTable(readErr)) {
        console.error('delete_account readings:', readErr.message);
        return res.status(500).json({ error: 'Could not delete your saved readings. Your account is still here; please try again.', reason: readErr.message });
      }
      if (readErr) console.log('delete_account: no readings table, skipping');

      // 3. The profile itself: name and birth details.
      const { error: profErr } = await supabase.from('profiles').delete().eq('id', userId);
      if (profErr) {
        console.error('delete_account profiles:', profErr.message);
        return res.status(500).json({ error: 'Could not delete your birth details. Your account is still here; please try again.', reason: profErr.message });
      }

      // 4. The sign-in account, last.
      const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
      if (authErr) {
        console.error('delete_account auth user:', authErr.message);
        return res.status(500).json({ error: 'Your details were removed, but the account itself could not be closed. Please write to elsewhereastro@gmail.com and we will finish it.', reason: authErr.message });
      }

      console.log('delete_account completed for', userId);
      return res.json({ deleted: true });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
