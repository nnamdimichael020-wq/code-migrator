import { NextResponse } from "next/server";
import { kvConfig } from "../../../../../lib/kv.js";
import {
  authConfig,
  appBase,
  parseCookies,
  STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  exchangeGoogleCode,
  fetchGoogleProfile,
  sanitizeProfile,
  upsertGoogleUser,
  sessionPayload,
  signPayload
} from "../../../../../lib/auth.js";

export async function GET(request) {
  const config = authConfig();
  const base = appBase(request);
  const url = new URL(request.url);

  // User cancelled at Google, or Google rejected the request — no session,
  // straight back to the tool. No charge, no state.
  if (url.searchParams.get("error")) {
    return NextResponse.redirect(`${base}/`, { status: 302 });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = parseCookies(request)[STATE_COOKIE];

  if (!config.clientId || !config.clientSecret || !config.sessionSecret) {
    return NextResponse.redirect(`${base}/?auth=unconfigured`, { status: 302 });
  }
  // CSRF: the state in the URL must match the state we set before redirecting.
  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${base}/?auth=state`, { status: 302 });
  }

  const redirectUri = `${base}/api/auth/google/callback`;
  try {
    const tokens = await exchangeGoogleCode({
      code,
      redirectUri,
      clientId: config.clientId,
      clientSecret: config.clientSecret
    });
    const profile = await fetchGoogleProfile(tokens.access_token);
    if (!profile?.sub) throw new Error("Google profile missing sub");

    const clean = sanitizeProfile({ email: profile.email, name: profile.name });
    const user = await upsertGoogleUser(kvConfig(), {
      googleId: profile.sub,
      email: clean.email,
      name: clean.name
    });
    const token = await signPayload(sessionPayload(user), config.sessionSecret);

    const res = NextResponse.redirect(`${base}/pro`, { status: 302 });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE
    });
    res.cookies.set(STATE_COOKIE, "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });
    return res;
  } catch (error) {
    console.error("OAuth callback error:", error?.message || error);
    return NextResponse.redirect(`${base}/?auth=error`, { status: 302 });
  }
}
