import test from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_MAX_AGE,
  clearCookieString,
  cookieString,
  googleAuthUrl,
  parseCookies,
  sanitizeProfile,
  sessionPayload,
  signPayload,
  verifyToken
} from "../auth.js";

test("cookieString sets HttpOnly, Secure, SameSite=Lax and Max-Age", () => {
  const c = cookieString("cs_session", "abc", { maxAge: 100 });
  assert.ok(c.includes("cs_session=abc"));
  assert.ok(c.includes("HttpOnly"));
  assert.ok(c.includes("Secure"));
  assert.ok(c.includes("SameSite=Lax"));
  assert.ok(c.includes("Max-Age=100"));
  assert.ok(c.includes("Path=/"));
});

test("clearCookieString expires immediately", () => {
  assert.ok(clearCookieString("cs_session").includes("Max-Age=0"));
});

test("parseCookies decodes values and handles multiple cookies", () => {
  const req = { headers: new Headers({ cookie: "a=1; b=hello%20world; cs_session=xyz" }) };
  const cookies = parseCookies(req);
  assert.equal(cookies.a, "1");
  assert.equal(cookies.b, "hello world");
  assert.equal(cookies.cs_session, "xyz");
});

test("parseCookies handles an empty header", () => {
  const req = { headers: new Headers() };
  assert.deepEqual(parseCookies(req), {});
});

test("signed tokens verify round-trip and reject tampering, wrong secret and expiry", async () => {
  const secret = "test-secret-please-ignore";
  const payload = { sub: "g-123", email: "a@b.com", plan: "free", exp: Math.floor(Date.now() / 1000) + 1000 };
  const token = await signPayload(payload, secret);

  const verified = await verifyToken(token, secret);
  assert.equal(verified.sub, "g-123");
  assert.equal(verified.plan, "free");

  // Tampered payload
  const tampered = token.slice(0, -3) + "abc";
  assert.equal(await verifyToken(tampered, secret), null);

  // Wrong secret
  assert.equal(await verifyToken(token, "other-secret"), null);

  // Expired
  const expired = await signPayload({ sub: "x", exp: Math.floor(Date.now() / 1000) - 10 }, secret);
  assert.equal(await verifyToken(expired, secret), null);

  // Garbage
  assert.equal(await verifyToken("not-a-token", secret), null);
  assert.equal(await verifyToken("", secret), null);
});

test("sessionPayload defaults to free and preserves pro", () => {
  const free = sessionPayload({ googleId: "g1", email: "a@b.com", plan: "free" });
  assert.equal(free.plan, "free");
  assert.equal(free.sub, "g1");
  const pro = sessionPayload({ googleId: "g1", plan: "pro" });
  assert.equal(pro.plan, "pro");
  assert.ok(pro.exp > Math.floor(Date.now() / 1000));
  assert.ok(pro.exp <= Math.floor(Date.now() / 1000) + SESSION_MAX_AGE);
});

test("sanitizeProfile lowercases email and strips tags/control from name", () => {
  const clean = sanitizeProfile({ email: "  ADA@Example.COM ", name: "Ada <script>x</script> Lovelace\u0007" });
  assert.equal(clean.email, "ada@example.com");
  assert.ok(!clean.name.includes("<"));
  assert.ok(!clean.name.includes("\u0007"));
  assert.equal(clean.name, "Ada x Lovelace"); // tags removed, text joined
});

test("sanitizeProfile never returns more than the caps", () => {
  const clean = sanitizeProfile({ email: "a".repeat(400) + "@x.com", name: "n".repeat(200) });
  assert.ok(clean.email.length <= 254);
  assert.ok(clean.name.length <= 80);
});

test("googleAuthUrl contains minimal scopes, state and response_type=code", () => {
  const url = new URL(googleAuthUrl({ clientId: "cid", redirectUri: "https://x/api/auth/google/callback", state: "s1" }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("client_id"), "cid");
  assert.equal(url.searchParams.get("redirect_uri"), "https://x/api/auth/google/callback");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("state"), "s1");
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.equal(url.searchParams.get("prompt"), "select_account");
});
