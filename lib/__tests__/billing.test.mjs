// Guards the Lemon Squeezy billing plumbing: signature verification (the
// webhook's only gate), the event -> plan mapping (the only path that flips
// entitlements), checkout payload (payer mapping + success redirect), and
// plan-aware limits.

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  buildCheckoutPayload,
  verifyLemonSignature,
  planFromLemonEvent,
  emailIndexKey,
  checkoutKey
} from "../billing.js";
import { inspectPaste, sizeLimitPayload, limitsForPlan, FREE_MAX_LINES, PRO_MAX_LINES } from "../limits.js";

const SECRET = "ls_whsec_test_123";

function sign(payload, secret = SECRET) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

const BODY = JSON.stringify({
  meta: { event_name: "subscription_created", custom_data: { googleId: "g_1" } },
  data: { id: "sub_1", attributes: { status: "active", user_email: "a@b.com" } }
});

// --- Signature verification (X-Signature = hex HMAC of the raw body) ---------

test("a correctly signed webhook payload passes", async () => {
  assert.equal(await verifyLemonSignature(BODY, sign(BODY), SECRET), true);
});

test("tampered payload, wrong secret, or missing pieces fail verification", async () => {
  assert.equal(await verifyLemonSignature(BODY + "x", sign(BODY), SECRET), false);
  assert.equal(await verifyLemonSignature(BODY, sign(BODY, "other_secret"), SECRET), false);
  assert.equal(await verifyLemonSignature(BODY, "", SECRET), false);
  assert.equal(await verifyLemonSignature("", sign(BODY), SECRET), false);
  assert.equal(await verifyLemonSignature(BODY, sign(BODY), ""), false);
  // Uppercase hex (some clients send it) still matches.
  assert.equal(await verifyLemonSignature(BODY, sign(BODY).toUpperCase(), SECRET), true);
});

// --- Event -> plan mapping ----------------------------------------------------

const subEvent = (name, attrs = {}, meta = {}) => ({
  meta: { event_name: name, ...meta },
  data: { id: "sub_9", attributes: { user_email: "u@x.com", ...attrs } }
});

test("subscription_created and payment_success grant pro", () => {
  assert.equal(planFromLemonEvent(subEvent("subscription_created")).plan, "pro");
  assert.equal(
    planFromLemonEvent(subEvent("subscription_payment_success", { status: "active" })).plan,
    "pro"
  );
});

test("subscription_updated maps status to the right plan", () => {
  const upd = (status) => planFromLemonEvent(subEvent("subscription_updated", { status }));
  assert.equal(upd("active").plan, "pro");
  assert.equal(upd("on_trial").plan, "pro");
  assert.equal(upd("unpaid").plan, "free");
  assert.equal(upd("paused").plan, "free");
  assert.equal(upd("cancelled").plan, "free"); // no ends_at -> access over
  assert.equal(upd("expired").plan, "free");
});

test("subscription_cancelled keeps pro until the paid period ends", () => {
  const now = Date.parse("2026-08-21T12:00:00Z");
  const future = subEvent("subscription_cancelled", {
    status: "cancelled",
    ends_at: "2026-09-01T00:00:00Z"
  });
  const past = subEvent("subscription_cancelled", {
    status: "cancelled",
    ends_at: "2026-08-01T00:00:00Z"
  });
  assert.equal(planFromLemonEvent(future, now).plan, "pro", "still inside the paid period");
  assert.equal(planFromLemonEvent(past, now).plan, "free", "period already over");
});

test("subscription_expired drops to free", () => {
  assert.equal(planFromLemonEvent(subEvent("subscription_expired")).plan, "free");
});

test("payer identity resolves from custom data, then email", () => {
  const withCustom = planFromLemonEvent(
    subEvent("subscription_created", {}, { custom_data: { googleId: "g_42" } })
  );
  assert.equal(withCustom.googleId, "g_42");

  const withoutCustom = planFromLemonEvent(subEvent("subscription_updated", { status: "active" }));
  assert.equal(withoutCustom.googleId, null);
  assert.equal(withoutCustom.email, "u@x.com", "email fallback is surfaced for KV lookup");
});

test("unknown or malformed events are ignored safely", () => {
  assert.equal(planFromLemonEvent(subEvent("order_created")), null);
  assert.equal(planFromLemonEvent({ meta: {} }), null);
  assert.equal(planFromLemonEvent(null), null);
});

// --- Checkout payload -----------------------------------------------------------

test("checkout payload maps the payer and rides our confirm token", () => {
  const payload = buildCheckoutPayload({
    storeId: "12345",
    variantId: "67890",
    baseUrl: "https://example.com",
    confirmToken: "tok-abc",
    googleId: "g_42",
    email: "a@b.com"
  });
  const attrs = payload.data.attributes;
  assert.equal(payload.data.type, "checkouts");
  assert.equal(attrs.checkout_data.custom.googleId, "g_42");
  assert.equal(attrs.checkout_data.email, "a@b.com");
  assert.equal(attrs.product_options.redirect_url, "https://example.com/pro/success?c=tok-abc");
  assert.equal(payload.data.relationships.store.data.id, "12345");
  assert.equal(payload.data.relationships.variant.data.id, "67890");
});

test("email is omitted (not empty) when unknown", () => {
  const payload = buildCheckoutPayload({
    storeId: 1, variantId: 2, baseUrl: "https://x.com", confirmToken: "t", googleId: "g"
  });
  assert.ok(!("email" in payload.data.attributes.checkout_data));
});

// --- KV key helpers ----------------------------------------------------------------

test("kv keys are namespaced and normalised", () => {
  assert.equal(checkoutKey("tok"), "checkout:tok");
  assert.equal(emailIndexKey("A@B.com "), "byemail:a@b.com");
});

// --- Plan-aware limits ---------------------------------------------------------------

test("limits scale by plan: free 200/12k, pro 500/30k", () => {
  assert.deepEqual(limitsForPlan("free"), { maxLines: FREE_MAX_LINES, maxChars: 12000 });
  assert.deepEqual(limitsForPlan("pro"), { maxLines: PRO_MAX_LINES, maxChars: 30000 });
  const paste300 = "SELECT 1;\n".repeat(300);
  assert.equal(inspectPaste(paste300, "free").tooLong, true);
  assert.equal(inspectPaste(paste300, "pro").tooLong, false);
  const paste600 = "SELECT 1;\n".repeat(600);
  assert.equal(inspectPaste(paste600, "pro").tooLong, true);
});

test("size-limit messages name the right plan ceiling", () => {
  assert.ok(sizeLimitPayload("free", 250).error.includes(String(FREE_MAX_LINES)));
  assert.ok(sizeLimitPayload("free", 250).error.includes(String(PRO_MAX_LINES)));
  assert.ok(sizeLimitPayload("pro", 600).error.includes(String(PRO_MAX_LINES)));
  assert.equal(sizeLimitPayload("pro", 600).limit, PRO_MAX_LINES);
});
