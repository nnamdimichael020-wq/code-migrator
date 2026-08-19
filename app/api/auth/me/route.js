import { NextResponse } from "next/server";
import { kvConfig } from "../../../../lib/kv.js";
import { authConfig, readSessionFromRequest, getUser } from "../../../../lib/auth.js";

export async function GET(request) {
  const session = await readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { loggedIn: false, email: "", name: "", plan: "free" },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  // Plan comes from the user record when KV is reachable (so a future billing
  // upgrade is picked up immediately); otherwise fall back to the cookie.
  let plan = session.plan === "pro" ? "pro" : "free";
  const config = kvConfig();
  if (config) {
    try {
      const user = await getUser(config, session.sub);
      if (user) plan = user.plan === "pro" ? "pro" : "free";
    } catch {
      // KV hiccup — cookie plan is fine.
    }
  }

  return NextResponse.json(
    {
      loggedIn: true,
      email: session.email || "",
      name: session.name || "",
      plan
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
