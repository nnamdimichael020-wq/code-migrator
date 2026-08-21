// Google OAuth (authorization code flow) + signed session cookies.
//
// Used ONLY at the Pro gate. The free tier never touches this code path.
//
// Sessions are stateless HMAC-signed cookies (SESSION_SECRET) so there is no
// server-side session store. Users are persisted in KV (plan defaults to
// "free"); if KV is unavailable the session cookie still carries identity so
// login keeps working and /api/auth/me falls back to the cookie's plan.

import { kvConfig, kvGet, kvPut } from "./kv.js";

export const SESSION_COOKIE = "cs_session";
export const STATE_COOKIE = "cs_oauth_state";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const STATE_MAX_AGE = 600; // 10 minutes

export function authConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    sessionSecret: process.env.SESSION_SECRET,
    baseUrl: process.env.APP_BASE_URL || ""
  };
}

export function isAuthConfigured(config = authConfig()) {
  return Boolean(config.clientId && config.clientSecret && config.sessionSecret);
}

// Production uses APP_BASE_URL; the request origin covers preview/staging.
export function appBase(request) {
  return authConfig().baseUrl || new URL(request.url).origin;
}

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

export function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) {
      try {
        out[name] = decodeURIComponent(value);
      } catch {
        out[name] = value;
      }
    }
  }
  return out;
}

export function cookieString(name, value, { maxAge = SESSION_MAX_AGE, path = "/" } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax"
  ];
  if (maxAge > 0) parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}

export function clearCookieString(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// ---------------------------------------------------------------------------
// Signed tokens (HMAC-SHA256 via Web Crypto — available on Workers and Node)
// ---------------------------------------------------------------------------

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function b64urlEncode(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function signPayload(payload, secret) {
  const data = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    new TextEncoder().encode(data)
  );
  return `${data}.${b64urlEncode(new Uint8Array(sig))}`;
}

export async function verifyToken(token, secret) {
  if (!token || typeof token !== "string" || !secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  try {
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(sigB64),
      new TextEncoder().encode(data)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(data)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function sessionPayload(user, nowSec = Math.floor(Date.now() / 1000)) {
  return {
    sub: user.googleId,
    email: user.email || "",
    name: user.name || "",
    plan: user.plan === "pro" ? "pro" : "free",
    exp: nowSec + SESSION_MAX_AGE
  };
}

export async function readSessionFromRequest(request) {
  const config = authConfig();
  if (!config.sessionSecret) return null;
  const cookies = parseCookies(request);
  return verifyToken(cookies[SESSION_COOKIE], config.sessionSecret);
}

export function randomState() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Google OAuth endpoints
// ---------------------------------------------------------------------------

export function googleAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account"
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode({ code, redirectUri, clientId, clientSecret }) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || `Token exchange failed (${res.status})`);
  }
  return data;
}

export async function fetchGoogleProfile(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || `Profile fetch failed (${res.status})`);
  }
  return data; // { sub, email, name, picture, ... }
}

// ---------------------------------------------------------------------------
// Profile sanitisation + KV user records
// ---------------------------------------------------------------------------

export function sanitizeProfile({ email, name } = {}) {
  const cleanEmail = String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .slice(0, 254);
  const cleanName = String(name || "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return { email: cleanEmail, name: cleanName };
}

function userKey(googleId) {
  return `user:${googleId}`;
}

export async function getUser(config, googleId) {
  if (!config || !googleId) return null;
  const raw = await kvGet(config, userKey(googleId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// New Google users always start on plan "free". Existing users keep their
// plan — only verified billing events (lib/billing.js) ever set "pro".
export async function upsertGoogleUser(config, { googleId, email, name }) {
  const now = new Date().toISOString();
  const existing = config ? await getUser(config, googleId) : null;
  const user = existing || {
    id: googleId,
    googleId,
    email: "",
    name: "",
    plan: "free",
    createdAt: now
  };
  if (email) user.email = email;
  if (name) user.name = name;
  user.lastLoginAt = now;
  if (config) await kvPut(config, userKey(googleId), JSON.stringify(user));
  return user;
}

// The only writer that flips plan. Called exclusively from verified billing
// paths (signed webhook, or a checkout fetched back from the payment API) —
// never from client input. Provider ids are merged in when present so a
// later customer portal / cancellation flow has them.
export async function setUserPlan(config, googleId, plan, patch = {}) {
  if (!config || !googleId) return null;
  if (plan !== "pro" && plan !== "free") return null;
  const user = (await getUser(config, googleId)) || {
    id: googleId,
    googleId,
    email: "",
    name: "",
    plan: "free",
    createdAt: new Date().toISOString()
  };
  user.plan = plan;
  user.planUpdatedAt = new Date().toISOString();
  for (const key of Object.keys(patch)) {
    if (patch[key]) user[key] = patch[key];
  }
  await kvPut(config, userKey(googleId), JSON.stringify(user));
  return user;
}
