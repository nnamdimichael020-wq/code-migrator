// Free-tier size rules, shared by the UI and the API so they cannot drift.
//
// Over-limit pastes must never reach Gemini — that is how a 5,000-line file
// burned the free token bucket. Multi-statement pastes that still fit are
// allowed; we only hint that Pro will be the place for batches later.

export const FREE_MAX_LINES = 200;
export const FREE_MAX_CHARS = 12000;
export const MULTI_STATEMENT_HINT = 3;
export const SIZE_LIMIT_CODE = "FREE_SIZE_LIMIT";

export function inspectPaste(code) {
  const text = String(code || "");
  const trimmed = text.trim();
  const lineCount = trimmed ? text.split(/\r?\n/).length : 0;
  const charCount = text.length;
  const statementCount = trimmed ? countStatements(text) : 0;
  const tooLong = lineCount > FREE_MAX_LINES || charCount > FREE_MAX_CHARS;
  const multiStatement = statementCount >= MULTI_STATEMENT_HINT;
  return { lineCount, charCount, statementCount, tooLong, multiStatement };
}

export function sizeLimitPayload(lineCount) {
  return {
    error:
      `This paste is ${lineCount} lines. Free converts one snippet up to ${FREE_MAX_LINES} lines. Split it, or wait for Pro for longer scripts.`,
    code: SIZE_LIMIT_CODE,
    lineCount,
    limit: FREE_MAX_LINES
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
