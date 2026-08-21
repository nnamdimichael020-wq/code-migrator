// Lemon Squeezy billing for the Pro plan — checkout API + webhook entitlement.
//
// Lemon Squeezy is the merchant of record: it hosts the card page, handles
// receipts, taxes and cancellations, and pays out to countries Stripe does
// not serve (the founder is in Nigeria). Zero new npm dependencies — the
// checkout API is JSON:API over fetch and webhook signatures verify with
// HMAC-SHA256 via Web Crypto, matching the project's integration pattern.
//
// Money rules enforced here:
//   - plan only flips to "pro" from verified Lemon Squeezy events (signed
//     webhook) or a checkout fetched back from the API and confirmed paid —
//     never from anything the client sends.
//   - the webhook requires a valid X-Signature (constant-time compare) and
//     answers 2xx fast so deliveries don't retry.

import { kvGet, kvPut } from "./kv.js";
import { setUserPlan } from "./auth.js";

export const PRO_PRICE_LABEL = "$7/month";

const LS_API = "https://api.lemonsqueezy.com/v1";
const CHECKOUT_TTL = 86400;        // checkout mapping: 1 day
const EMAIL_INDEX_TTL = 63072000;  // email -> googleId index: 2 years

export function billingConfig() {
  return {
    apiKey: process.env.LEMON_SQUEEZY_API_KEY,
    storeId: process.env.LEMON_SQUEEZY_STORE_ID,
    variantId: process.env.LEMON_SQUEEZY_VARIANT_ID,
    webhookSecret: process.env.LEMON_SQUEEZY_WEBHOOK_SECRET,
    baseUrl: process.env.APP_BASE_URL || ""
  };
}

export function isBillingConfigured(config = billingConfig()) {
  return Boolean(
    config.apiKey && config.storeId && config.variantId && config.webhookSecret
  );
}

// ---------------------------------------------------------------------------
// Checkout (JSON:API)
// ---------------------------------------------------------------------------

// Pure payload builder — unit-tested. `confirmToken` is an id WE generate, so
// the success redirect can find its KV mapping without depending on Lemon
// Squeezy appending anything to the redirect URL.
export function buildCheckoutPayload({ storeId, variantId, baseUrl, confirmToken, googleId, email }) {
  return {
    data: {
      type: "checkouts",
      attributes: {
        product_options: {
          redirect_url: `${baseUrl}/pro/success?c=${confirmToken}`
        },
        checkout_data: {
          ...(email ? { email } : {}),
          custom: { googleId: String(googleId) }
        }
      },
      relationships: {
        store: { data: { type: "stores", id: String(storeId) } },
        variant: { data: { type: "variants", id: String(variantId) } }
      }
    }
  };
}

async function lemonRequest(path, { method = "GET", body, apiKey } = {}) {
  const res = await fetch(`${LS_API}/${path}`, {
    method,
    headers: {
      Accept: "application/vnd.api+json",
      ...(body ? { "Content-Type": "application/vnd.api+json" } : {}),
      Authorization: `Bearer ${apiKey}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) {
    const detail =
      data?.errors?.[0]?.detail || data?.errors?.[0]?.title ||
      `Lemon Squeezy request failed (${res.status})`;
    const error = new Error(detail);
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function createLemonCheckout({ apiKey, storeId, variantId, baseUrl, googleId, email, confirmToken }) {
  const body = buildCheckoutPayload({ storeId, variantId, baseUrl, confirmToken, googleId, email });
  const data = await lemonRequest("checkouts", { method: "POST", body, apiKey });
  const url = data?.data?.attributes?.url;
  if (!url) throw new Error("Lemon Squeezy did not return a checkout URL.");
  return { id: data?.data?.id || null, url };
}

export async function retrieveLemonCheckout({ apiKey, checkoutId }) {
  const data = await lemonRequest(`checkouts/${encodeURIComponent(checkoutId)}`, { apiKey });
  return data?.data || null;
}

export function checkoutIsPaid(checkout) {
  const status = checkout?.attributes?.status;
  return status === "paid" || status === "completed";
}

// ---------------------------------------------------------------------------
// Webhook signature: X-Signature = hex HMAC-SHA256 of the raw body
// ---------------------------------------------------------------------------

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

export async function verifyLemonSignature(payload, signature, secret) {
  if (!payload || !signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  // Hex is case-insensitive; Lemon Squeezy sends lowercase but tolerate both.
  return constantTimeEqual(toHex(sig).toLowerCase(), String(signature).trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// KV mappings: our confirm token -> checkout, and email -> googleId fallback
// ---------------------------------------------------------------------------

export function checkoutKey(token) {
  return `checkout:${token}`;
}

export function emailIndexKey(email) {
  return `byemail:${String(email || "").trim().toLowerCase()}`;
}

export async function storeCheckoutMapping(kv, token, { lemonCheckoutId, googleId, email }) {
  if (!kv || !token || !googleId) return;
  await kvPut(
    kv,
    checkoutKey(token),
    JSON.stringify({ lemonCheckoutId: lemonCheckoutId || null, googleId }),
    CHECKOUT_TTL
  );
  if (email) {
    await kvPut(kv, emailIndexKey(email), googleId, EMAIL_INDEX_TTL);
  }
}

export async function getCheckoutMapping(kv, token) {
  if (!kv || !token) return null;
  const raw = await kvGet(kv, checkoutKey(token));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function googleIdForEmail(kv, email) {
  if (!kv || !email) return null;
  const raw = await kvGet(kv, emailIndexKey(email));
  return raw || null;
}

// ---------------------------------------------------------------------------
// Event -> plan mapping (pure; applied against KV by applyLemonEvent)
// ---------------------------------------------------------------------------

const PRO_STATUSES = new Set(["active", "on_trial"]);

export function planFromLemonEvent(event, nowMs = Date.now()) {
  const name = event?.meta?.event_name;
  const attrs = event?.data?.attributes || {};
  if (!name) return null;

  // Where the payer identity lives: custom data we sent to the checkout is
  // echoed in meta.custom_data; subscription objects may carry custom_data of
  // their own; user_email is the last resort (resolved via the KV index).
  const identifiers = {
    googleId:
      event?.meta?.custom_data?.googleId ||
      attrs.custom_data?.googleId ||
      null,
    email: attrs.user_email || null
  };

  switch (name) {
    case "subscription_created":
    case "subscription_payment_success":
      // A subscription being created or a payment (first or renewal)
      // succeeding means active entitlement.
      return { ...identifiers, plan: "pro" };

    case "subscription_updated":
      // active/on_trial keep Pro; cancelled/expired/unpaid/paused lose it.
      return { ...identifiers, plan: PRO_STATUSES.has(attrs.status) ? "pro" : "free" };

    case "subscription_cancelled": {
      // Cancelling keeps access until the end of the paid period (ends_at).
      const endsAt = attrs.ends_at ? Date.parse(attrs.ends_at) : NaN;
      const stillPaid = Number.isFinite(endsAt) && endsAt > nowMs;
      return { ...identifiers, plan: stillPaid ? "pro" : "free" };
    }

    case "subscription_expired":
      return { ...identifiers, plan: "free" };

    default:
      // Unknown events are safely ignored (order_created, license keys, …).
      return null;
  }
}

// Applies a verified event to KV. Returns the applied mapping or null.
export async function applyLemonEvent(kv, event, nowMs = Date.now()) {
  const mapping = planFromLemonEvent(event, nowMs);
  if (!mapping || !kv) return null;

  let googleId = mapping.googleId;
  if (!googleId && mapping.email) {
    googleId = await googleIdForEmail(kv, mapping.email);
  }
  if (!googleId) return null;

  // Self-heal the email index so later events without custom_data resolve.
  if (mapping.email) {
    await kvPut(kv, emailIndexKey(mapping.email), googleId, EMAIL_INDEX_TTL);
  }

  const attrs = event?.data?.attributes || {};
  await setUserPlan(kv, googleId, mapping.plan, {
    lemonSubscriptionId: event?.data?.id || null,
    lemonCustomerId: attrs.customer_id || null,
    lemonStatus: attrs.status || null
  });
  return { googleId, plan: mapping.plan };
}
