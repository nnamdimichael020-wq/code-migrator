// Free-tier size rules, shared by the UI and the API so they cannot drift.
//
// Over-limit pastes must never reach Gemini — that is how a 5,000-line file
// burned the free token bucket. Multi-statement pastes that still fit are
// allowed; we only hint that Pro will be the place for batches later.

export const FREE_MAX_LINES = 200;
export const FREE_MAX_CHARS = 12000;
// Pro entitlement: unlimited conversions plus a higher single-paste cap.
// 500 lines / 30k chars still fits one Gemini call comfortably — chunking
// for truly huge files remains a separate future feature and is NOT promised.
export const PRO_MAX_LINES = 500;
export const PRO_MAX_CHARS = 30000;
export const MULTI_STATEMENT_HINT = 3;
export const SIZE_LIMIT_CODE = "FREE_SIZE_LIMIT";

export function limitsForPlan(plan) {
  return plan === "pro"
    ? { maxLines: PRO_MAX_LINES, maxChars: PRO_MAX_CHARS }
    : { maxLines: FREE_MAX_LINES, maxChars: FREE_MAX_CHARS };
}

export function inspectPaste(code, plan = "free") {
  const text = String(code || "");
  const trimmed = text.trim();
  const lineCount = trimmed ? text.split(/\r?\n/).length : 0;
  const charCount = text.length;
  const statementCount = trimmed ? countStatements(text) : 0;
  const { maxLines, maxChars } = limitsForPlan(plan);
  const tooLong = lineCount > maxLines || charCount > maxChars;
  const multiStatement = statementCount >= MULTI_STATEMENT_HINT;
  return { lineCount, charCount, statementCount, tooLong, multiStatement };
}

export function sizeLimitPayload(plan, lineCount) {
  const { maxLines } = limitsForPlan(plan);
  return {
    error:
      plan === "pro"
        ? `This paste is ${lineCount} lines. Pro converts single scripts up to ${maxLines} lines — split it into pieces.`
        : `This paste is ${lineCount} lines. Free converts one snippet up to ${maxLines} lines. Split it, or go Pro for scripts up to ${PRO_MAX_LINES} lines.`,
    code: SIZE_LIMIT_CODE,
    lineCount,
    limit: maxLines
  };
}

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "")
    .replace(/#.*$/gm, "")
    .replace(/\/\/.*$/gm, "");
}

function countStatements(text) {
  const stripped = stripComments(text);
  const sql = (
    stripped.match(
      /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|MERGE|WITH|ALTER|DROP|GRANT|TRUNCATE|REPLACE|CALL|BEGIN)\b/gim
    ) || []
  ).length;
  const routines = (
    stripped.match(
      /^\s*(def |async def |function |export (default )?function |export (default )?async function |class |Sub |Function |Public Sub |Private Sub |Public Function |Private Function )/gim
    ) || []
  ).length;
  const semis = (stripped.match(/;\s*$/gm) || []).length;
  return Math.max(sql, routines, semis);
}
