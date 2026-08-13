import { NextResponse } from "next/server";

const DAILY_LIMIT = 3;
const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];

function utcDate() {
  return new Date().toISOString().slice(0, 10);
}

function clientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("true-client-ip") ||
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

function networkKey(ip) {
  if (!ip || ip === "unknown") return "unknown";
  if (ip.includes(":")) {
    const head = ip.split("::")[0].split(":").filter(Boolean).slice(0, 4).join(":");
    return `v6:${head || "unknown"}`;
  }
  return `v4:${ip}`;
}

function readVisitorId(request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)cs_vid=([a-zA-Z0-9_-]{16,80})/);
  if (match) return { id: match[1], isNew: false };
  return { id: crypto.randomUUID(), isNew: true };
}

function visitorCookie(id) {
  return `cs_vid=${id}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
}

function usageConfig() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const namespaceId = process.env.CF_KV_NAMESPACE_ID;
  const token = process.env.CF_API_TOKEN;
  if (!accountId || !namespaceId || !token) return null;
  return { accountId, namespaceId, token };
}

function usageUrl(config, key) {
  return `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/${encodeURIComponent(key)}`;
}

function jsonWithUsage(body, visitor, status = 200) {
  const headers = {
    "Cache-Control": "no-store, max-age=0"
  };
  if (visitor.isNew) {
    headers["Set-Cookie"] = visitorCookie(visitor.id);
  }
  return NextResponse.json(body, { status, headers });
}

async function readCount(config, key) {
  const res = await fetch(usageUrl(config, key), {
    headers: { Authorization: `Bearer ${config.token}` }
  });
  if (res.status === 404) return 0;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Usage store read failed (${res.status}): ${text.slice(0, 180)}`);
  }
  const used = parseInt(await res.text(), 10);
  return Number.isFinite(used) ? used : 0;
}

async function writeCount(config, key, used) {
  const res = await fetch(`${usageUrl(config, key)}?expiration_ttl=172800`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "text/plain"
    },
    body: String(used)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Usage store write failed (${res.status}): ${text.slice(0, 180)}`);
  }
}

function usageKeys(request, visitorId) {
  const ip = clientIp(request);
  const day = utcDate();
  return {
    visitor: `${day}:vid:${visitorId}`,
    ip: `${day}:ip:${ip}`,
    net: `${day}:net:${networkKey(ip)}`
  };
}

async function loadUsage(request, visitorId) {
  const config = usageConfig();
  if (!config) return { used: 0, configured: false, keys: null, counts: null, config: null };

  const keys = usageKeys(request, visitorId);
  const [visitor, ip, net] = await Promise.all([
    readCount(config, keys.visitor),
    readCount(config, keys.ip),
    readCount(config, keys.net)
  ]);

  return {
    used: Math.max(visitor, ip, net),
    counts: { visitor, ip, net },
    configured: true,
    keys,
    config
  };
}

async function bumpUsage(usage) {
  const next = usage.used + 1;
  await Promise.all([
    writeCount(usage.config, usage.keys.visitor, Math.max(usage.counts.visitor, next)),
    writeCount(usage.config, usage.keys.ip, Math.max(usage.counts.ip, next)),
    writeCount(usage.config, usage.keys.net, Math.max(usage.counts.net, next))
  ]);
  return next;
}

function usagePayload(used) {
  const safeUsed = Math.max(0, used);
  return {
    used: safeUsed,
    remaining: Math.max(0, DAILY_LIMIT - safeUsed),
    limit: DAILY_LIMIT
  };
}

function extractText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const steps = Array.isArray(data?.steps) ? data.steps : [];
  const texts = [];

  for (const step of steps) {
    if (step?.type === "model_output" && Array.isArray(step.content)) {
      for (const part of step.content) {
        if (part?.type === "text" && part.text) {
          texts.push(part.text);
        }
      }
    }
  }

  if (texts.length) return texts.join("\n");
  if (data?.outputs?.[0]?.text) return data.outputs[0].text;
  if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text;
  }

  return "";
}

function parseModelJson(raw) {
  let text = String(raw || "").trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  return JSON.parse(text);
}

export async function GET(request) {
  const visitor = readVisitorId(request);
  try {
    const usage = await loadUsage(request, visitor.id);
    if (!usage.configured) {
      return jsonWithUsage(
        {
          ...usagePayload(0),
          configured: false,
          error: "Usage store is not configured yet."
        },
        visitor
      );
    }
    return jsonWithUsage({ ...usagePayload(usage.used), configured: true }, visitor);
  } catch (error) {
    return jsonWithUsage(
      { error: error?.message || "Could not read usage." },
      visitor,
      500
    );
  }
}

export async function POST(request) {
  const visitor = readVisitorId(request);
  try {
    const { sourceLang, targetLang, code } = await request.json();

    if (!code || !sourceLang || !targetLang) {
      return jsonWithUsage({ error: "Missing required fields" }, visitor, 400);
    }

    const usage = await loadUsage(request, visitor.id);
    if (!usage.configured) {
      return jsonWithUsage(
        {
          error:
            "Usage store is not configured. Add CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, and CF_API_TOKEN in Cloudflare secrets."
        },
        visitor,
        500
      );
    }

    if (usage.used >= DAILY_LIMIT) {
      return jsonWithUsage(
        {
          error: "Daily free limit reached.",
          ...usagePayload(usage.used)
        },
        visitor,
        429
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return jsonWithUsage(
        {
          error:
            "GEMINI_API_KEY is missing. Add it in Cloudflare → Workers & Pages → code-migrator → Settings → Variables and secrets."
        },
        visitor,
        500
      );
    }

    const requestBody = {
      store: false,
      system_instruction:
        "You are an expert code and SQL migration engine. Convert the code accurately. Keep behavior the same. Use idiomatic target syntax. Explain only the important differences.",
      input: `Convert this code from ${sourceLang} to ${targetLang}.\n\nCode:\n${code}`,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: {
          type: "object",
          properties: {
            convertedCode: { type: "string" },
            explanation: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["convertedCode", "explanation"]
        }
      },
      generation_config: {
        thinking_level: "low"
      }
    };

    let lastError = "Gemini did not return a usable conversion.";
    let lastStatus = 500;

    for (const model of MODELS) {
      const apiResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({ ...requestBody, model })
        }
      );

      const data = await apiResponse.json();

      if (!apiResponse.ok) {
        lastError = data?.error?.message || JSON.stringify(data);
        lastStatus = apiResponse.status === 429 ? 503 : apiResponse.status;

        if (
          /no longer available|not found|not supported|not available to new users|is not available|quota|rate.limit|resource exhausted|too many requests/i.test(
            lastError
          )
        ) {
          continue;
        }

        return jsonWithUsage(
          { error: lastError, ...usagePayload(usage.used) },
          visitor,
          lastStatus
        );
      }

      const rawText = extractText(data);
      if (!rawText) {
        lastError = "Gemini returned no text.";
        continue;
      }

      let parsed;
      try {
        parsed = parseModelJson(rawText);
      } catch {
        parsed = {
          convertedCode: rawText,
          explanation: ["Returned as plain text because JSON parsing failed."]
        };
      }

      if (!parsed.convertedCode) {
        lastError = "Gemini JSON was missing convertedCode.";
        continue;
      }

      const used = await bumpUsage(usage);

      return jsonWithUsage(
        {
          convertedCode: parsed.convertedCode,
          explanation: Array.isArray(parsed.explanation) ? parsed.explanation : [],
          ...usagePayload(used)
        },
        visitor
      );
    }

    return jsonWithUsage(
      { error: lastError, ...usagePayload(usage.used) },
      visitor,
      lastStatus === 429 ? 503 : lastStatus
    );
  } catch (error) {
    return jsonWithUsage(
      { error: error?.message || "Internal server error." },
      visitor,
      500
    );
  }
}
