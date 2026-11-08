// api/create-checkout.js — creates a Stripe Checkout session
//
// The browser calls this endpoint when someone clicks "buy". It asks
// Stripe to create a hosted Checkout session for the Map Guide price and
// returns the URL of Stripe's payment page. The browser then sends the
// person to that URL, where Stripe handles all card entry and payment —
// your site never touches card data.
//
// On success Stripe does TWO independent things:
//   1. Redirects the buyer to success.html?session_id=... (the bridge page
//      that sends them a magic link so they can sign in and unlock the
//      report). The session_id lets that page look up their email.
//   2. Fires the stripe-webhook (checkout.session.completed), which is the
//      AUTHORITATIVE record that writes the purchase to Supabase.
// The webhook — not the redirect — is the source of truth for "did they
// pay". The redirect is only for the buyer's experience.
//
// EMAIL: We let Stripe Checkout collect the buyer's email. Stripe includes
// that email on the session, so both the webhook (to record the purchase)
// and the success page (to send the magic link) can read it.
//
// Env vars used:
//   STRIPE_SECRET_KEY — sk_live_... (the site runs on Stripe LIVE mode)

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─────────────────────────────────────────────────────────────
//  PRICE ID — hardcoded for simplicity.
//
//  >>> WHEN YOU GO LIVE: replace this TEST price id with your LIVE
//  >>> price id (also starts with price_...). Live mode has a DIFFERENT
//  >>> price id than test mode. This is the ONE line to change for launch.
// ─────────────────────────────────────────────────────────────
const MAP_GUIDE_PRICE_ID = 'price_1TyLmg4mWfCuIJLWwIkCl3AQ'; // LIVE price
// Report prices (LIVE). If one is ever left blank, its buy button returns a
// clear "not on sale yet" message and the Map Guide is unaffected.
//   Sandbox ids, for reference only (they do NOT work with the live key):
//     one report  price_1UZbme4mWfCuIJLWQkXzz5sc
//     all three   price_1UZbnk4mWfCuIJLWAzTv5gKc
const REPORT_PRICE_ID     = 'price_1UZc854mWfCuIJLWXxEBZel9'; // LIVE price — one Best Places report ($22.22)
const REPORT_ALL_PRICE_ID = 'price_1UZc944mWfCuIJLW3vOJiwog'; // LIVE price — all three reports ($44.44)

// What a buy button can ask for. The label is saved on the purchase by
// stripe-webhook.js, so the report page knows which report was paid for.
const PRODUCTS = {
  map_guide:     MAP_GUIDE_PRICE_ID,
  report_love:   REPORT_PRICE_ID,
  report_career: REPORT_PRICE_ID,
  report_home:   REPORT_PRICE_ID,
  report_all:    REPORT_ALL_PRICE_ID
};

// If someone backs out of a report checkout, send them home.
const REPORT_CANCEL_URL = 'https://www.elsewhereastro.com/';

// Where Stripe sends the buyer after checkout.
//   success -> the bridge page, WITH the checkout session id so it can look
//              up the buyer's email and send them a magic link.
//   cancel  -> back to the map guide sales page.
// {CHECKOUT_SESSION_ID} is a placeholder Stripe fills in automatically.
const SUCCESS_URL = 'https://www.elsewhereastro.com/success.html?session_id={CHECKOUT_SESSION_ID}';
const CANCEL_URL  = 'https://www.elsewhereastro.com/map-guide.html';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // The buy button says which product it is. No product given = Map Guide,
  // so the existing Map Guide button keeps working exactly as before.
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const product = body.product || 'map_guide';
  if (!(product in PRODUCTS)) {
    return res.status(400).json({ error: 'Unknown product' });
  }
  const price = PRODUCTS[product];
  if (!price) {
    return res.status(503).json({ error: 'This report is not on sale yet (live price not set up).' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        { price: price, quantity: 1 }
      ],
      billing_address_collection: 'auto',
      metadata: { product: product },
      success_url: SUCCESS_URL + '&product=' + product,
      cancel_url: product === 'map_guide' ? CANCEL_URL : REPORT_CANCEL_URL
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
