import { NextResponse } from "next/server";
import {
  authConfig,
  isAuthConfigured,
  googleAuthUrl,
  randomState,
  appBase,
  STATE_COOKIE,
  STATE_MAX_AGE
} from "../../../../lib/auth.js";

export async function GET(request) {
  const config = authConfig();
  if (!isAuthConfigured(config)) {
    return NextResponse.json(
      { error: "Google Sign-In is not configured yet." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const redirectUri = `${appBase(request)}/api/auth/google/callback`;
  const state = randomState();
  const url = googleAuthUrl({ clientId: config.clientId, redirectUri, state });

  const res = NextResponse.redirect(url, { status: 302 });
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: STATE_MAX_AGE
  });
  return res;
}
