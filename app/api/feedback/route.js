import { NextResponse } from "next/server";
import { sendFeedbackEmail, validateFeedback } from "../../../lib/feedback.js";
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

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const checked = validateFeedback(body || {});
    if (checked.error) {
      return NextResponse.json({ error: checked.error }, { status: 400, headers: HEADERS });
    }

    const rl = await rateLimit("feedback", clientIp(request), {
      maxPerDay: 5,
      minIntervalMs: 60000
    });
    if (!rl.ok) {
      return NextResponse.json({ error: rl.error }, { status: 429, headers: HEADERS });
    }

    const sent = await sendFeedbackEmail(checked.value);
    if (!sent.ok) {
      return NextResponse.json({ error: sent.error }, { status: 503, headers: HEADERS });
    }
    return NextResponse.json({ ok: true }, { headers: HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Could not send feedback." },
      { status: 500, headers: HEADERS }
    );
  }
}
