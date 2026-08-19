// Simple per-IP rate limiting for the review and feedback endpoints,
// stored in KV so it survives restarts and is shared across visitors.
//
// Fail-open by design: if the KV store errors, the request is allowed
// through rather than blocking real users.

import { kvConfig, kvGet, kvPut } from "./kv.js";

const RATE_TTL = 172800; // 2 days

export async function rateLimit(
  action,
  ip,
  { maxPerDay = 5, minIntervalMs = 30000 } = {}
) {
  const config = kvConfig();
  if (!config) return { ok: true }; // protection layer only — fail open if unconfigured

  const safeIp = String(ip || "unknown").slice(0, 64);
  const key = `rl:${action}:${safeIp}`;

  let state = { count: 0, last: 0 };
  try {
    const raw = await kvGet(config, key);
    if (raw) {
      try {
        state = JSON.parse(raw);
      } catch {
        state = { count: 0, last: 0 };
      }
    }
  } catch {
    // Store unavailable — fail open rather than blocking everyone.
    return { ok: true };
  }

  const now = Date.now();
  if (state.count >= maxPerDay) {
    return {
      ok: false,
      error: "You've submitted too many today. Please try again tomorrow."
    };
  }
  if (now - (state.last || 0) < minIntervalMs) {
    return { ok: false, error: "Please wait a moment before submitting again." };
  }

  try {
    await kvPut(config, key, JSON.stringify({ count: state.count + 1, last: now }), RATE_TTL);
  } catch {
    // Tolerate write failure; the count check above still protects.
  }
  return { ok: true };
}
