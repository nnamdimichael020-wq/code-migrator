import { NextResponse } from "next/server";
import { inspectPaste, sizeLimitPayload } from "../../../lib/limits.js";
const DAILY_LIMIT = 3;
// Optional schema context (DDL) sent alongside the code. Capped well under
// the free token budget so a giant CREATE script can't burn the quota.
const SCHEMA_MAX_CHARS = 8000;
const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];
const ALLOWED_LANGUAGES = [
  "PostgreSQL",
  "Oracle SQL",
  "Snowflake SQL",
  "Google BigQuery",
  "MySQL",
  "Python",
  "JavaScript / Node.js",
  "TypeScript",
  "Excel VBA",
  "C#",
  "Java",
  "PHP"
];
// Shared preamble + closing rules. Only the middle section differs between the
// two conversion styles, so the parts that must never drift live here once.
const INSTRUCTION_HEAD = [
  "You are an expert code and SQL migration engine.",
  "Convert the code accurately and preserve observable behaviour."
];
// Applies to both styles. Correctness is not a mode the user can switch off:
// even in "idiomatic" the model must refuse a rewrite that changes semantics.
const INSTRUCTION_TAIL = [
  "Correctness outranks style in both modes. If a rewrite would change behaviour —",
  "NULL handling, ordering, error semantics, side effects, numeric precision —",
  "keep the faithful version and say why in the explanation.",
  "",
  "In `explanation`, list only what matters: behaviour that changes between the",
  "two languages, and any place you departed from the source's structure.",
  "",
  "Also return `pitfalls`: an array of silent behaviour differences that apply",
  "to THIS conversion — things that compile or run but can change results",
  "(NULL handling, ordering, empty-string semantics, integer division, 0- vs",
  "1-based indexes). Empty array if none apply to the pasted code. Do not invent",
  "generic warnings that are unrelated to this snippet."
];
// IDIOMATIC (default). The rule that matters most: translate into what a senior
// engineer in the TARGET language would write, not a line-by-line mirror of the
// source's control flow. A literal transliteration compiles and passes review,
// but carries the source language's performance profile with it — VBA row loops
// becoming df.iterrows() is the classic case.
const IDIOMATIC_RULES = [
  "Write idiomatic code for the TARGET language. Do not mirror the source's",
  "control flow when the target has a native construct for the same job.",
  "",
  "- Python with pandas or numpy: do not emit df.iterrows(), df.itertuples() or",
  "  index loops that append to parallel lists when the same result can be",
  "  produced with vectorised column operations, boolean masks, np.where or",
  "  np.select. Use .apply() only for logic that genuinely cannot be vectorised.",
  "  Row-by-row iteration discards the C-level speed of the underlying arrays.",
  "- SQL: use set-based statements, not cursors or row-at-a-time loops.",
  "- JavaScript and TypeScript: prefer map, filter, reduce and async/await over",
  "  manual index loops and nested callbacks where it reads more clearly."
];
// LITERAL. For reviewers migrating production code who need a line-for-line
// audit trail against the original. Structure-preserving is the whole point —
// so the anti-iterrows rule is deliberately absent here, and a row loop in the
// source is expected to stay a row loop in the output.
const LITERAL_RULES = [
  "Translate as literally as the target language allows. Preserve the source's",
  "structure so the result can be diffed line-for-line against the original.",
  "",
  "- Keep the same statement order, control flow and nesting depth.",
  "- Keep loops as loops. Do not vectorise, do not collapse a loop into a set-based",
  "  or functional expression, even where that would be faster or more idiomatic.",
  "- Keep the source's variable, column and function names unless the target",
  "  language forbids them.",
  "- Do not merge, split or reorder statements, and do not add abstractions,",
  "  helper functions or error handling that the source did not have.",
  "",
  "Use target-language syntax that actually compiles and runs — literal means",
  "structure-preserving, not a broken transliteration."
];
// SQL dialects — the only languages where a pasted DDL changes how the
// conversion itself must be done.
const SQL_LANGUAGES = new Set([
  "PostgreSQL",
  "Oracle SQL",
  "Snowflake SQL",
  "Google BigQuery",
  "MySQL"
]);
function isSqlConversion(sourceLang, targetLang) {
  return SQL_LANGUAGES.has(sourceLang) || SQL_LANGUAGES.has(targetLang);
}
// Schema-aware SQL conversion. When a DDL accompanies the code it is
// authoritative ground truth: real types, columns and constraints replace
// every guess, and every pitfall must survive a check against the schema.
// This is what makes the converter measurably better than generic tools on
// schema-backed migrations.
const SQL_SCHEMA_HEAD = [
  "You are an expert SQL dialect migration engine specializing in schema-backed",
  "Oracle → PostgreSQL and cross-dialect conversions with very high accuracy.",
  "A table schema (DDL) accompanies this request. Treat it as the",
  "authoritative ground truth: the ONLY source of column names, types, precision,",
  "scale and nullability. Whenever the DDL conflicts with general dialect",
  "knowledge, the DDL wins."
];
// Deterministic Oracle → PostgreSQL type reference. Oracle is the highest-traffic
// source dialect and the biggest source of NUMBER / VARCHAR2 / DATE, so the full
// table lives here; other pairs apply the same principles via GENERAL_TYPE_RULES.
const ORACLE_TO_POSTGRES_TYPES = [
  "NUMBER(p, s)              → NUMERIC(p, s)        keep precision p and scale s exactly",
  "NUMBER(p) / NUMBER(p, 0)  → SMALLINT | INTEGER | BIGINT | NUMERIC(p)   by p: 1-4 smallint, 5-9 integer, 10-18 bigint, >18 numeric(p)",
  "NUMBER (no p, no s)       → NUMERIC               arbitrary precision — never INTEGER, never a float",
  "VARCHAR2(n) / (n CHAR)    → VARCHAR(n)            keep the width",
  "CHAR(n) / NCHAR(n)        → CHAR(n)",
  "CLOB / LONG               → TEXT",
  "BLOB / RAW(n)             → BYTEA",
  "DATE                      → DATE                  Oracle DATE holds a time-of-day; use TIMESTAMP only when the code uses the time",
  "TIMESTAMP(n)              → TIMESTAMP(n)",
  "TIMESTAMP WITH TIME ZONE  → TIMESTAMPTZ",
  "FLOAT / BINARY_FLOAT      → REAL",
  "BINARY_DOUBLE             → DOUBLE PRECISION"
];
const GENERAL_TYPE_RULES = [
  "Map each source type to its closest native target type. Carry precision and",
  "scale through verbatim (NUMERIC(p,s), DECIMAL(p,s), VARCHAR(n)). Never drop a",
  "declared width or scale, and never invent one the source did not have."
];
const SCHEMA_CORE_SQL = [
  "Step 0 — parse the DDL before converting. Build a column map of",
  "  {table → {column → (type, precision, scale, nullable)}} from the provided",
  "  DDL, then resolve EVERY column reference in the code against that map.",
  "  Do not convert line-by-line first and check types afterwards.",
  "",
  "1. Types, precision and scale — use them, do not guess.",
  "   - Carry precision and scale through verbatim. NUMBER(10,2) becomes",
  "     NUMERIC(10,2), never a bare DECIMAL.",
  "   - Choose integer widths from precision: a NUMBER(5) counter is INTEGER,",
  "     never BIGINT; a NUMBER(20) key is BIGINT, never INTEGER.",
  "   - An unconstrained NUMBER is NUMERIC (arbitrary precision), never a float",
  "     and never INTEGER — that silently loses precision.",
  "   - VARCHAR2(n) keeps its width: VARCHAR(n).",
  "   - DATE maps to DATE; widen to TIMESTAMP only when the code reads or",
  "     compares the time-of-day component.",
  "",
  "2. Nullability — mirror it exactly.",
  "   - A NOT NULL column must never receive NULL in the output, and logic on it",
  "     needs no defensive NULL handling.",
  "   - A nullable column keeps its NULL semantics: add COALESCE / IS NULL /",
  "     NULLIF only where the source logic itself tolerates NULL.",
  "   - Do not add or remove NULL-handling in a way that changes which rows match.",
  "",
  "3. Function and expression rewrites, driven by the actual column type.",
  "   - Remove redundant casts: TO_DATE / TO_CHAR on a column the DDL already",
  "     declares DATE is dropped; a cast on NUMERIC stays only where arithmetic",
  "     requires it.",
  "   - Date functions follow the column type: DATE columns prefer CURRENT_DATE",
  "     and plain date arithmetic; use CURRENT_TIMESTAMP / NOW() only when",
  "     time-of-day matters.",
  "   - NVL / NVL2 / DECODE expand to the cleanest CASE (or COALESCE) for the",
  "     column's type: numeric columns COALESCE(col, 0), text columns",
  "     COALESCE(col, '').",
  "   - Preserve result types: arithmetic on NUMERIC(p,s) must yield NUMERIC with",
  "     an appropriate scale, not a silently widened or truncated value.",
  "",
  "4. Silent-pitfall reduction — prove or drop every warning.",
  "   - Re-check each candidate pitfall against the DDL and emit it ONLY if it",
  "     can still occur in THIS conversion.",
  "   - Examples of suppression: the empty-string-vs-NULL trap does not apply to",
  "     a column the DDL declares NOT NULL; a time-zone warning does not apply to",
  "     a DATE column used date-only.",
  "   - Always keep genuine behavioural differences (ROWNUM vs LIMIT ordering,",
  "     string concatenation with NULL, implicit vs explicit casts).",
  "   - Every pitfall you DO emit must name the specific column or expression it",
  "     concerns; never emit generic, unrelated warnings.",
  "",
  "5. Output.",
  "   - `convertedCode` contains ONLY the converted SQL — no commentary, no",
  "     markdown fences, clean indentation, aliases preserved.",
  "   - `explanation` lists what changed and why, including any type, precision,",
  "     scale or nullability decision the schema drove, and any column the code",
  "     references that the DDL does not define."
];
// Idiomatic style on top of a schema: readability and native form win over a
// line-for-line mirror, while the schema keeps it honest.
const SCHEMA_IDIOMATIC_SQL = [
  "Idiomatic quality: produce clean, modern, native target-dialect SQL. Prefer",
  "readability and correctness over a literal 1:1 translation, and keep the",
  "output production-ready."
];
// Literal style on top of a schema: the structure stays line-for-line, but
// the schema still owns every type and name decision.
const SCHEMA_LITERAL_SQL = [
  "Schema fidelity in literal mode: keep the line-for-line structure this mode",
  "requires, but take every type, column name, constraint and nullability from",
  "the schema — literal means structure-preserving, not guessed."
];
// SQL conversion with no DDL: best-effort, and visibly conservative about any
// type it has to assume.
const NO_SCHEMA_SQL_RULES = [
  "No schema (DDL) was provided. Fall back to best-effort conversion using",
  "general dialect knowledge and stay conservative with type assumptions: never",
  "invent precision or scale, and note in `explanation` every place a type had",
  "to be guessed."
];
function buildInstruction(style, ctx = {}) {
  const rules = style === "literal" ? LITERAL_RULES : IDIOMATIC_RULES;
  const schemaSql = Boolean(ctx.sqlConversion && ctx.hasSchema);
  const head = schemaSql ? SQL_SCHEMA_HEAD : INSTRUCTION_HEAD;
  const sections = [head, "", rules];
  if (ctx.sqlConversion) {
    if (ctx.hasSchema) {
      sections.push("", SCHEMA_CORE_SQL);
      if (ctx.sourceLang === "Oracle SQL" && ctx.targetLang === "PostgreSQL") {
        sections.push(
          "",
          "Oracle → PostgreSQL type reference (follow it exactly):",
          ORACLE_TO_POSTGRES_TYPES
        );
      } else {
        sections.push("", GENERAL_TYPE_RULES);
      }
      sections.push(
        "",
        style === "literal" ? SCHEMA_LITERAL_SQL : SCHEMA_IDIOMATIC_SQL
      );
    } else {
      sections.push("", NO_SCHEMA_SQL_RULES);
    }
  }
  sections.push("", INSTRUCTION_TAIL);
  return sections.flat().join("\n");
}
const STYLES = ["idiomatic", "literal"];
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
async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: false, error: "Human check is not configured on the server." };
  }
  if (!token || typeof token !== "string") {
    return { ok: false, error: "Human check missing. Refresh the page and wait a second." };
  }
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await res.json();
  if (!data?.success) {
    return { ok: false, error: "Human check failed. Refresh the page and try again." };
  }
  return { ok: true };
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
        const { sourceLang, targetLang, code, turnstileToken, style, schema } = await request.json();
        // Unknown or missing style falls back to idiomatic rather than erroring,
        // so an older cached client keeps working after a deploy.
        const conversionStyle = STYLES.includes(style) ? style : "idiomatic";
        // Optional schema/DDL context. Missing, empty or non-string values are
        // simply ignored so the endpoint stays backward compatible.
        const schemaText = typeof schema === "string" ? schema.trim() : "";
        const hasSchema = schemaText.length > 0;
        // SQL dialects get schema-aware conversion rules; a DDL pasted into a
        // non-SQL conversion still travels with the code, but the SQL-specific
        // mandates do not apply.
        const sqlConversion = isSqlConversion(sourceLang, targetLang);
        if (schemaText.length > SCHEMA_MAX_CHARS) {
          return jsonWithUsage(
            { error: `Schema context is too long. Keep it under ${SCHEMA_MAX_CHARS} characters.` },
            visitor,
            400
          );
        }
        if (!code || !sourceLang || !targetLang) {
      return jsonWithUsage({ error: "Missing required fields" }, visitor, 400);
    }
    if (!ALLOWED_LANGUAGES.includes(sourceLang) || !ALLOWED_LANGUAGES.includes(targetLang)) {
      return jsonWithUsage({ error: "Unsupported language pair." }, visitor, 400);
    }
    const human = await verifyTurnstile(turnstileToken, clientIp(request));
    if (!human.ok) {
      return jsonWithUsage({ error: human.error }, visitor, 403);
    }
    const paste = inspectPaste(code);
    if (paste.tooLong) {
      return jsonWithUsage(sizeLimitPayload(paste.lineCount), visitor, 400);
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
      system_instruction: buildInstruction(conversionStyle, { sqlConversion, hasSchema, sourceLang, targetLang }),
      input:
        `Convert this code from ${sourceLang} to ${targetLang}.\n\nCode:\n${code}` +
        (schemaText
          ? `\n\nTable schema (DDL) — authoritative ground truth: its types, columns, constraints and nullability override any assumption:\n${schemaText}`
          : ""),
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
            },
            pitfalls: {
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
    const friendlyQuota = /quota|rate.limit|resource exhausted|too many requests|input_token/i.test(
      lastError
    );
    return jsonWithUsage(
      {
        error: friendlyQuota
          ? "The AI free quota is tired or this paste is too large. Wait a minute and try a short snippet (under 200 lines)."
          : lastError,
        ...usagePayload(usage.used)
      },
      visitor,
      friendlyQuota ? 503 : lastStatus
    );
  } catch (error) {
    return jsonWithUsage(
      { error: error?.message || "Internal server error." },
      visitor,
      500
    );
  }
}
