import { NextResponse } from "next/server";
import { kvConfig } from "../../../../lib/kv.js";
import { billingConfig, verifyLemonSignature, applyLemonEvent } from "../../../../lib/billing.js";

// Lemon Squeezy -> CodeShift entitlement webhook.
//
// Contract:
//   - The raw body is read BEFORE any parsing: the signature covers the exact
//     bytes Lemon Squeezy sent.
//   - Every request must carry a valid X-Signature (hex HMAC-SHA256 of the
//     raw body with the webhook signing secret, compared constant-time).
//     Unsigned or tampered calls get a 400 and never touch user records.
//   - Verified events are applied to KV and answered 200 fast so deliveries
//     don't retry. Unknown events also get 200 (safely ignored).
//
// Plan flips:
//   subscription_created / subscription_payment_success      -> pro
//   subscription_updated (active/on_trial)                    -> pro
//   subscription_updated (cancelled/expired/unpaid/paused)    -> free
//   subscription_cancelled  -> pro until ends_at, then free
//   subscription_expired                                     -> free
//
// Payer resolution: meta.custom_data.googleId (set at checkout) ->
// subscription custom_data -> email index in KV (written at checkout and
// self-healed by earlier events).

export async function POST(request) {
  const payload = await request.text();
  const signature = request.headers.get("x-signature") || request.headers.get("X-Signature");

  const config = billingConfig();
  if (!config.webhookSecret) {
    // Nothing we can verify against — refuse rather than trust blindly.
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const valid = await verifyLemonSignature(payload, signature, config.webhookSecret);
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
    const applied = await applyLemonEvent(kvConfig(), event);
    // applied === null means "recognized event, no resolvable payer" — 200 so
    // Lemon Squeezy stops retrying; the next event in the chain self-heals
    // the email index.
    return NextResponse.json({ received: true, applied: Boolean(applied) });
  } catch (error) {
    // 500 so Lemon Squeezy retries; never 200 without applying a plan flip.
    console.error("billing webhook apply failed:", error?.message);
    return NextResponse.json({ error: "Could not apply event." }, { status: 500 });
  }
}
