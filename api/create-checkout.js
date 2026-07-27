// api/create-checkout.js — creates a Stripe Checkout session
//
// The browser calls this endpoint when someone clicks "buy". It asks
// Stripe to create a hosted Checkout session for the Map Guide price and
// returns the URL of Stripe's payment page. The browser then sends the
// person to that URL, where Stripe handles all card entry and payment —
// your site never touches card data.
//
// On success Stripe does TWO independent things:
//   1. Redirects the buyer back to success_url (the report page).
//   2. Fires the stripe-webhook (checkout.session.completed), which is the
//      AUTHORITATIVE record that writes the purchase to Supabase.
// The webhook — not this redirect — is the source of truth for "did they
// pay". The redirect is only for the buyer's experience.
//
// EMAIL: We let Stripe Checkout collect the buyer's email. Stripe includes
// that email on the session, so the webhook can tie the purchase to it.
// This is the thread linking the payment to the (magic-link) account.
//
// Env vars used:
//   STRIPE_SECRET_KEY — sk_test_... (already set in Vercel)

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─────────────────────────────────────────────────────────────
//  PRICE ID — hardcoded for simplicity.
//
//  >>> WHEN YOU GO LIVE: replace this TEST price id with your LIVE
//  >>> price id (also starts with price_...). Live mode has a DIFFERENT
//  >>> price id than test mode. This is the ONE line to change for launch.
// ─────────────────────────────────────────────────────────────
const MAP_GUIDE_PRICE_ID = 'price_1TijpH7RcMeDWK0MOHLwVPpB'; // TEST price

// Where Stripe sends the buyer after checkout.
const SUCCESS_URL = 'https://www.elsewhereastro.com/report.html';
const CANCEL_URL  = 'https://www.elsewhereastro.com/';

export default async function handler(req, res) {
  // Basic CORS so the browser on your site can call this.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',                       // one-time payment (not subscription)
      line_items: [
        { price: MAP_GUIDE_PRICE_ID, quantity: 1 }
      ],

      // Collect the buyer's email so the webhook can attribute the
      // purchase. Stripe puts it on session.customer_details.email.
      billing_address_collection: 'auto',

      // Tag the product so the webhook records it as map_guide (leaving
      // room for future best-places reports to share the purchases table).
      metadata: { product: 'map_guide' },

      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL
    });

    // Return the hosted Checkout URL. The browser will redirect to it.
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
