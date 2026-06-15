// api/stripe-webhook.js — Stripe payment webhook (source of truth)
//
// Stripe calls this endpoint server-to-server the moment a payment
// completes. It is the AUTHORITATIVE record that a purchase happened —
// never the customer's browser. Even if the buyer closes their tab right
// after paying, Stripe still notifies this endpoint, and the purchase
// gets written to Supabase.
//
// SECURITY — signature verification:
//   This URL is public, so anyone could POST a fake "payment succeeded"
//   event to try to grant themselves a free report. To prevent that, every
//   Stripe webhook is signed with a secret. This endpoint verifies that
//   signature against STRIPE_WEBHOOK_SECRET and REJECTS anything that
//   doesn't match. Without this check, the webhook would be a free-report
//   button for anyone who found the URL.
//
// RAW BODY:
//   Signature verification must run against the EXACT raw bytes Stripe
//   sent. Vercel/Next normally auto-parses JSON into an object, which
//   destroys those bytes and makes verification fail with a confusing
//   "signature" error. The `config` export below disables body parsing so
//   we can read the raw body ourselves.
//
// IDEMPOTENT:
//   Stripe may deliver the same event more than once (it retries to be
//   safe). We upsert on stripe_session_id (a UNIQUE column), so a repeat
//   delivery can't create a duplicate purchase row.
//
// Env vars (set in Vercel — never in code):
//   STRIPE_SECRET_KEY      — sk_test_... (then sk_live_... in production)
//   STRIPE_WEBHOOK_SECRET  — whsec_...   (generated when you register this
//                            endpoint in the Stripe dashboard)
//   SUPABASE_URL           — already set
//   SUPABASE_SERVICE_KEY   — already set

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Disable Vercel's automatic body parsing so we can read the raw bytes
// that Stripe's signature was computed over.
export const config = {
  api: {
    bodyParser: false
  }
};

// Read the raw request body as a Buffer (needed for signature check).
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'];

  // ── Step 1: read raw body + verify it's really from Stripe ────
  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    // Either the body couldn't be read or the signature didn't match.
    // Reject — do NOT trust this request.
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // ── Step 2: act only on the event we care about ───────────────
  // checkout.session.completed fires when a Checkout payment succeeds.
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Only record it if the session is actually paid. (For one-time
    // payments this is 'paid'; we guard against unpaid/no-payment states.)
    if (session.payment_status === 'paid') {
      // Stripe collects the buyer's email at checkout. Prefer the
      // customer_details email; fall back to customer_email if present.
      const email =
        (session.customer_details && session.customer_details.email) ||
        session.customer_email ||
        null;

      if (!email) {
        // No email means we can't tie the purchase to anyone. Log it and
        // acknowledge (200) so Stripe doesn't keep retrying a stuck event,
        // but flag it for manual review.
        console.error('checkout.session.completed with no email:', session.id);
        return res.status(200).json({ received: true, warning: 'no email on session' });
      }

      // Upsert on stripe_session_id so a duplicate delivery of the same
      // event updates rather than duplicates. The product metadata lets
      // future best-places reports share this table.
      const product =
        (session.metadata && session.metadata.product) || 'map_guide';

      const { error: upsertErr } = await supabase
        .from('purchases')
        .upsert({
          email: email.toLowerCase(),
          product: product,
          status: 'paid',
          stripe_session_id: session.id,
          stripe_payment_id: session.payment_intent || null,
          amount_total: session.amount_total || null,
          currency: session.currency || null
        }, { onConflict: 'stripe_session_id' });

      if (upsertErr) {
        // If the write fails, return 500 so Stripe RETRIES the event
        // later — we don't want to lose a real purchase to a transient
        // database hiccup.
        console.error('Failed to record purchase:', upsertErr.message);
        return res.status(500).json({ error: 'Failed to record purchase' });
      }

      console.log('Purchase recorded for', email, 'session', session.id);
    }
  }

  // ── Step 3: acknowledge receipt ───────────────────────────────
  // Always 200 for events we handled (or chose to ignore), so Stripe
  // knows we got them and stops retrying.
  return res.status(200).json({ received: true });
}
