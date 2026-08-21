import { NextResponse } from "next/server";
import { kvConfig } from "../../../../lib/kv.js";
import { billingConfig, verifyStripeSignature, applyStripeEvent } from "../../../../lib/billing.js";

// Stripe -> CodeShift entitlement webhook.
//
// Contract:
//   - The raw body is read BEFORE any parsing: the signature covers the exact
//     bytes Stripe sent.
//   - Every request must carry a valid Stripe-Signature (HMAC-SHA256 of
//     "t.payload", 5-minute replay tolerance). Unsigned or tampered calls
//     get a 400 and never touch the user records.
//   - Verified events are applied to KV and answered 200 fast, so Stripe
//     doesn't retry. Events we don't act on also get 200.
//
// Plan flips:
//   checkout.session.completed              -> pro
//   customer.subscription.updated (active)  -> pro
//   customer.subscription.updated (past_due/unpaid/canceled) -> free
//   customer.subscription.deleted           -> free

export async function POST(request) {
  const payload = await request.text();
  const signature =
    request.headers.get("stripe-signature") || request.headers.get("Stripe-Signature");

  const config = billingConfig();
  if (!config.webhookSecret) {
    // Nothing we can verify against — refuse rather than trust blindly.
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const valid = await verifyStripeSignature(payload, signature, config.webhookSecret);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    await applyStripeEvent(kvConfig(), event);
  } catch (error) {
    // Log-and-500: Stripe retries, and the next attempt usually succeeds
    // (transient KV failures). Never 200 without applying a plan flip.
    console.error("billing webhook apply failed:", error?.message);
    return NextResponse.json({ error: "Could not apply event." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
