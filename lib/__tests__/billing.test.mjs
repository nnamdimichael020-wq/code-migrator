// Guards the Stripe billing plumbing: signature verification (the webhook's
// only gate), the event -> plan mapping (the only path that flips
// entitlements), checkout params (payer mapping), and plan-aware limits.

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  buildCheckoutParams,
  verifyStripeSignature,
  planFromEvent
} from "../billing.js";
import { inspectPaste, sizeLimitPayload, limitsForPlan, FREE_MAX_LINES, PRO_MAX_LINES } from "../limits.js";

const SECRET = "whsec_test_123";

function signedHeader(payload, secret = SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

const BODY = JSON.stringify({
  id: "evt_1",
  type: "checkout.session.completed",
  data: { object: { metadata: { googleId: "g_1" } } }
});

// --- Signature verification ---------------------------------------------------

test("a correctly signed webhook payload passes", async () => {
  assert.equal(await verifyStripeSignature(BODY, signedHeader(BODY), SECRET), true);
});

test("tampered payload or wrong secret fails verification", async () => {
  const header = signedHeader(BODY);
  assert.equal(await verifyStripeSignature(BODY + "x", header, SECRET), false);
  assert.equal(await verifyStripeSignature(BODY, signedHeader(BODY, "whsec_other"), SECRET), false);
});

test("replayed signatures outside the tolerance window fail", async () => {
  const stale = Math.floor(Date.now() / 1000) - 3600; // 1h old
  assert.equal(
    await verifyStripeSignature(BODY, signedHeader(BODY, SECRET, stale), SECRET),
    false
  );
});

test("missing pieces never verify", async () => {
  assert.equal(await verifyStripeSignature(BODY, "", SECRET), false);
  assert.equal(await verifyStripeSignature("", signedHeader(BODY), SECRET), false);
  assert.equal(await verifyStripeSignature(BODY, signedHeader(BODY), ""), false);
});

test("multiple v1 signatures are each considered", async () => {
  const t = Math.floor(Date.now() / 1000);
  const good = createHmac("sha256", SECRET).update(`${t}.${BODY}`).digest("hex");
  const junk = "0".repeat(64);
  assert.equal(
    await verifyStripeSignature(BODY, `t=${t},v1=${junk},v1=${good}`, SECRET),
    true
  );
});

// --- Event -> plan mapping ----------------------------------------------------

test("checkout.session.completed flips the payer to pro", () => {
  const out = planFromEvent({
    type: "checkout.session.completed",
    data: {
      object: {
        metadata: { googleId: "g_42" },
        customer: "cus_1",
        subscription: "sub_1"
      }
    }
  });
  assert.deepEqual(out, {
    googleId: "g_42",
    plan: "pro",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1"
  });
});

test("client_reference_id is the fallback payer mapping", () => {
  const out = planFromEvent({
    type: "checkout.session.completed",
    data: { object: { client_reference_id: "g_7" } }
  });
  assert.equal(out.googleId, "g_7");
  assert.equal(out.plan, "pro");
});

test("subscription lifecycle events map status to the right plan", () => {
  const sub = (status) => ({
    type: "customer.subscription.updated",
    data: { object: { metadata: { googleId: "g_1" }, status, id: "sub_9", customer: "cus_9" } }
  });
  assert.equal(planFromEvent(sub("active")).plan, "pro");
  assert.equal(planFromEvent(sub("trialing")).plan, "pro");
  assert.equal(planFromEvent(sub("past_due")).plan, "free");
  assert.equal(planFromEvent(sub("unpaid")).plan, "free");
  assert.equal(
    planFromEvent({
      type: "customer.subscription.deleted",
      data: { object: { metadata: { googleId: "g_1" }, id: "sub_9" } }
    }).plan,
    "free"
  );
});

test("events without a payer mapping or unrelated events are ignored", () => {
  assert.equal(
    planFromEvent({ type: "checkout.session.completed", data: { object: {} } }),
    null
  );
  assert.equal(
    planFromEvent({
      type: "customer.subscription.updated",
      data: { object: { status: "active" } } // no metadata.googleId
    }),
    null
  );
  assert.equal(planFromEvent({ type: "invoice.paid", data: { object: {} } }), null);
  assert.equal(planFromEvent({}), null);
});

// --- Checkout session params ---------------------------------------------------

test("checkout params build a subscription session that maps back to the payer", () => {
  const params = buildCheckoutParams({
    priceId: "price_7",
    baseUrl: "https://example.com",
    googleId: "g_42",
    email: "a@b.com"
  });
  assert.equal(params.get("mode"), "subscription");
  assert.equal(params.get("line_items[0][price]"), "price_7");
  assert.equal(params.get("line_items[0][quantity]"), "1");
  assert.equal(params.get("client_reference_id"), "g_42");
  assert.equal(params.get("metadata[googleId]"), "g_42");
  assert.equal(params.get("subscription_data[metadata][googleId]"), "g_42");
  assert.equal(params.get("customer_email"), "a@b.com");
  assert.equal(
    params.get("success_url"),
    "https://example.com/pro/success?session_id={CHECKOUT_SESSION_ID}"
  );
  assert.equal(params.get("cancel_url"), "https://example.com/pro/cancel");
});

// --- Plan-aware limits -----------------------------------------------------------

test("limits scale by plan: free 200/12k, pro 500/30k", () => {
  assert.deepEqual(limitsForPlan("free"), { maxLines: FREE_MAX_LINES, maxChars: 12000 });
  assert.deepEqual(limitsForPlan("pro"), { maxLines: PRO_MAX_LINES, maxChars: 30000 });
  // A 300-line paste: too long for free, fine for pro.
  const paste300 = "SELECT 1;\n".repeat(300);
  assert.equal(inspectPaste(paste300, "free").tooLong, true);
  assert.equal(inspectPaste(paste300, "pro").tooLong, false);
  // A 600-line paste is too long even for pro.
  const paste600 = "SELECT 1;\n".repeat(600);
  assert.equal(inspectPaste(paste600, "pro").tooLong, true);
});

test("size-limit messages name the right plan ceiling", () => {
  assert.ok(sizeLimitPayload("free", 250).error.includes(String(FREE_MAX_LINES)));
  assert.ok(sizeLimitPayload("free", 250).error.includes(String(PRO_MAX_LINES)));
  assert.ok(sizeLimitPayload("pro", 600).error.includes(String(PRO_MAX_LINES)));
  assert.equal(sizeLimitPayload("pro", 600).limit, PRO_MAX_LINES);
});
