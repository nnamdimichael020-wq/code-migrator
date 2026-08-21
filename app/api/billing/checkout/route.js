import { NextResponse } from "next/server";
import { kvConfig } from "../../../../lib/kv.js";
import { readSessionFromRequest, getUser } from "../../../../lib/auth.js";
import { billingConfig, isBillingConfigured, createCheckoutSession } from "../../../../lib/billing.js";

export async function POST(request) {
  const headers = { "Cache-Control": "no-store, max-age=0" };

  // Billing only starts from a signed-in session — the free tier never
  // touches this route.
  const session = await readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "Sign in with Google first — Go Pro starts from the Pro page." },
      { status: 401, headers }
    );
  }

  const config = billingConfig();
  if (!isBillingConfigured(config)) {
    return NextResponse.json(
      { error: "Checkout is not configured on the server yet. Please try again shortly." },
      { status: 503, headers }
    );
  }

  // Already Pro? No second charge — send them back to the Pro page.
  const kv = kvConfig();
  if (kv) {
    try {
      const user = await getUser(kv, session.sub);
      if (user?.plan === "pro") {
        return NextResponse.json({ alreadyPro: true, url: "/pro" }, { headers });
      }
    } catch {
      // KV hiccup: Stripe metadata still maps the payer, so proceed.
    }
  }

  try {
    const checkout = await createCheckoutSession({
      secretKey: config.secretKey,
      priceId: config.priceId,
      baseUrl: config.baseUrl || new URL(request.url).origin,
      googleId: session.sub,
      email: session.email || ""
    });
    if (!checkout?.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }
    return NextResponse.json({ url: checkout.url }, { headers });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Could not start checkout. Please try again." },
      { status: 502, headers }
    );
  }
}
