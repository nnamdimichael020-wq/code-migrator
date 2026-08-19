import { NextResponse } from "next/server";
import { kvConfig } from "../../../lib/kv.js";
import { addReview, listReviews, validateReview } from "../../../lib/reviews.js";
import { rateLimit } from "../../../lib/rateLimit.js";

const HEADERS = { "Cache-Control": "no-store, max-age=0" };

function clientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("true-client-ip") ||
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

export async function GET() {
  const config = kvConfig();
  if (!config) {
    return NextResponse.json(
      { reviews: [], configured: false },
      { headers: HEADERS }
    );
  }
  try {
    const reviews = await listReviews(config);
    return NextResponse.json(
      { reviews: reviews.slice(0, 50), configured: true },
      { headers: HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Could not load reviews." },
      { status: 500, headers: HEADERS }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const checked = validateReview({
      ...(body || {}),
      // Accept both client spellings without changing the public response shape.
      displayName: body?.displayName ?? body?.name
    });
    if (checked.error) {
      return NextResponse.json({ error: checked.error }, { status: 400, headers: HEADERS });
    }

    const config = kvConfig();
    if (!config) {
      return NextResponse.json(
        { error: "Reviews are not available yet." },
        { status: 503, headers: HEADERS }
      );
    }

    const rl = await rateLimit("review", clientIp(request), {
      maxPerDay: 5,
      minIntervalMs: 30000
    });
    if (!rl.ok) {
      return NextResponse.json({ error: rl.error }, { status: 429, headers: HEADERS });
    }

    const entry = await addReview(config, checked.value);
    return NextResponse.json({ ok: true, review: entry }, { headers: HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Could not save review." },
      { status: 500, headers: HEADERS }
    );
  }
}
