// Stripe billing for the Pro plan — Checkout Sessions + webhook entitlement.
//
// Zero new npm dependencies: Checkout Sessions and the Sessions API are plain
// form-encoded fetches, and webhook signature verification is HMAC-SHA256 via
// Web Crypto (the same primitive lib/auth.js uses for session cookies). This
// matches the project's no-SDK pattern for Google and Cloudflare.
//
// Money rules enforced here:
//   - plan only flips to "pro" from verified Stripe events or a verified
//     Checkout Session — never from anything the client sends.
//   - the webhook requires a valid Stripe-Signature (constant-time compare,
//     5-minute replay tolerance) and returns 2xx fast.

import { setUserPlan } from "./auth.js";

export const PRO_PRICE_LABEL = "$7/month";

export function billingConfig() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    priceId: process.env.STRIPE_PRICE_ID,
    baseUrl: process.env.APP_BASE_URL || ""
  };
}

export function isBillingConfigured(config = billingConfig()) {
  return Boolean(config.secretKey && config.priceId && config.webhookSecret);
}

// ---------------------------------------------------------------------------
// Checkout Session creation (pure param builder + fetch)
// ---------------------------------------------------------------------------

export function buildCheckoutParams({ priceId, baseUrl, googleId, email }) {
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${baseUrl}/pro/success?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${baseUrl}/pro/cancel`);
  // Map the payer back to the KV user record in every event that matters:
  // the session itself, and the subscription's own lifecycle events.
  params.set("client_reference_id", googleId);
  params.set("metadata[googleId]", googleId);
  if (email) params.set("metadata[email]", email);
  params.set("subscription_data[metadata][googleId]", googleId);
  if (email) params.set("customer_email", email);
  return params;
}

async function stripeRequest(path, { method = "GET", params, secretKey } = {}) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
    },
    body: params ? params.toString() : undefined
  });
  const data = await res.json();
  if (!res.ok) {
    const message = data?.error?.message || `Stripe request failed (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function createCheckoutSession({ secretKey, priceId, baseUrl, googleId, email }) {
  const params = buildCheckoutParams({ priceId, baseUrl, googleId, email });
  return stripeRequest("checkout/sessions", { method: "POST", params, secretKey });
}

export async function retrieveCheckoutSession({ secretKey, sessionId }) {
  return stripeRequest(`checkout/sessions/${encodeURIComponent(sessionId)}`, { secretKey });
}

// ---------------------------------------------------------------------------
// Webhook signature verification (Stripe spec: t=...,v1=...)
// ---------------------------------------------------------------------------

function parseStripeSignature(header) {
  const parts = String(header || "").split(",");
  let timestamp = null;
  const signatures = [];
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  }
  return { timestamp, signatures };
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a, b) {
  const aStr = String(a || "");
  const bStr = String(b || "");
  const max = Math.max(aStr.length, bStr.length);
  let diff = aStr.length === bStr.length ? 0 : 1;
  for (let i = 0; i < max; i++) {
    diff |= (aStr.charCodeAt(i) || 0) ^ (bStr.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(sig);
}

export async function verifyStripeSignature(
  payload,
  signatureHeader,
  secret,
  { nowMs = Date.now(), toleranceSec = 300 } = {}
) {
  if (!payload || !signatureHeader || !secret) return false;
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || signatures.length === 0) return false;
  const age = Math.floor(nowMs / 1000) - Number(timestamp);
  if (!Number.isFinite(age) || Math.abs(age) > toleranceSec) return false;
  const expected = await hmacHex(secret, `${timestamp}.${payload}`);
  return signatures.some((sig) => constantTimeEqual(expected, sig));
}

// ---------------------------------------------------------------------------
// Event -> plan mapping (pure; the route applies it via setUserPlan)
// ---------------------------------------------------------------------------

export function planFromEvent(event) {
  const type = event?.type;
  if (!type) return null;

  if (type === "checkout.session.completed") {
    const session = event.data?.object || {};
    const googleId = session.metadata?.googleId || session.client_reference_id;
    if (!googleId) return null;
    return {
      googleId,
      plan: "pro",
      stripeCustomerId: session.customer || null,
      stripeSubscriptionId: session.subscription || null
    };
  }

  if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
    const subscription = event.data?.object || {};
    const googleId = subscription.metadata?.googleId;
    if (!googleId) return null;
    const active = type === "customer.subscription.updated" &&
      ["active", "trialing"].includes(subscription.status);
    return {
      googleId,
      plan: active ? "pro" : "free",
      stripeCustomerId: subscription.customer || null,
      stripeSubscriptionId: subscription.id || null
    };
  }

  return null;
}

// Applies a verified event to KV. Returns the applied mapping or null.
export async function applyStripeEvent(kvConfig, event) {
  const mapping = planFromEvent(event);
  if (!mapping || !kvConfig) return null;
  await setUserPlan(kvConfig, mapping.googleId, mapping.plan, {
    stripeCustomerId: mapping.stripeCustomerId,
    stripeSubscriptionId: mapping.stripeSubscriptionId
  });
  return mapping;
}
