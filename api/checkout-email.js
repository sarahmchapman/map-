// api/checkout-email.js — returns the email on a completed checkout session
//
// The success page (success.html) calls this with the session_id Stripe put
// in the redirect URL. We look up that session on Stripe (server-side, using
// the secret key the browser never sees) and return the buyer's email, so
// the success page can send a magic link to it.
//
// SECURITY NOTE: this only reveals an email to whoever holds the session id,
// which Stripe only hands to the person who just completed that checkout in
// their own browser. It does not let anyone enumerate customers. We also
// confirm the session is actually paid before returning anything.
//
// Env vars used:
//   STRIPE_SECRET_KEY — sk_test_... (already set in Vercel)

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id } = req.body || {};
  if (!session_id) {
    return res.status(400).json({ error: 'session_id required' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Only reveal the email for a genuinely paid session.
    if (!session || session.payment_status !== 'paid') {
      return res.status(200).json({ paid: false, email: null });
    }

    const email =
      (session.customer_details && session.customer_details.email) ||
      session.customer_email ||
      null;

    return res.status(200).json({ paid: true, email: email });
  } catch (err) {
    console.error('checkout-email failed:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
