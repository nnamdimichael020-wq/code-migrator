// Visible "silent issues" signal after a conversion.
//
// This is not a confidence score. It merges three honest sources:
//   1. pitfalls the model returned for THIS conversion
//   2. keyword flags in the explanation (timezone, ROWNUM, NULL, …)
//   3. known pair-level traps that actually appear in the pasted code
//
// Pair gotchas that have nothing to do with the paste stay out of the count
// so a three-line SELECT does not claim "7 issues found".
//
// When a DDL is supplied, gotchas the schema can DISPROVE are dropped too:
// e.g. "Oracle treats '' as NULL" is provably irrelevant when every character
// column in the DDL is NOT NULL. Suppression only ever happens on proof —
// an unparseable or partial DDL keeps the warnings.

function schemaDisprovenGotchas(schemaText) {
  try {
    return charColumnsAllNotNull(schemaText) ? [/empty string/i] : [];
  } catch {
    return [];
  }
}

import { pairGotchas } from "./pairs.js";
import { reviewNotes } from "./classify.js";
import { charColumnsAllNotNull } from "./schema.js";

function tokensFromGotcha(text) {
  const raw = String(text || "");
  const quoted = [...raw.matchAll(/'([^']{2,40})'/g)].map((m) => m[1]);
  const stop = new Set([
    "NULL", "SQL", "AND", "THE", "FOR", "NOT", "ANY", "IS", "ON", "TO", "IN",
    "OR", "AS", "A", "AN", "OF", "BY", "IF", "NO", "SO", "WHERE", "FROM",
    "SELECT", "WITH", "THIS", "THAT", "THAN", "THEN", "ELSE", "WHEN", "INTO"
  ]);
  const words = (raw.match(/\b[A-Z][A-Z0-9_]{1,}\b/g) || []).filter((w) => !stop.has(w));
  return [...quoted, ...words];
}

function haystackOf({ explanation, inputCode, outputCode }) {
  const bullets = Array.isArray(explanation) ? explanation.join("\n") : "";
  return `${bullets}\n${inputCode || ""}\n${outputCode || ""}`;
}

function relevantPairGotchas(sourceLang, targetLang, haystack) {
  const all = pairGotchas(sourceLang, targetLang);
  if (!haystack.trim()) return [];
  const upper = haystack.toUpperCase();
  return all.filter((gotcha) => {
    // The empty-string trap's own text yields no usable trigger tokens (its
    // keywords are stop words), so it used to never fire at all. Give it the
    // precise trigger it describes: the paste actually writes '' or tests
    // NULL against a column.
    if (/empty string/i.test(gotcha)) {
      return /''|\bIS\s+NOT?\s+NULL\b/i.test(haystack);
    }
    const tokens = tokensFromGotcha(gotcha);
    if (tokens.length === 0) return false;
    return tokens.some((token) => upper.includes(String(token).toUpperCase()));
  });
}

export function collectIssues({
  explanation = [],
  sourceLang,
  targetLang,
  inputCode = "",
  outputCode = "",
  modelPitfalls = [],
  schemaText = ""
} = {}) {
  const fromModel = (Array.isArray(modelPitfalls) ? modelPitfalls : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const fromKeywords = reviewNotes(explanation);
  const haystack = haystackOf({ explanation, inputCode, outputCode });
  const disproven = schemaDisprovenGotchas(schemaText);
  const fromPair = relevantPairGotchas(sourceLang, targetLang, haystack)
    .filter((gotcha) => !disproven.some((re) => re.test(gotcha)));

  const seen = new Set();
  const issues = [];
  for (const item of [...fromModel, ...fromKeywords, ...fromPair]) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(item);
  }
  return issues;
}

export function issuesSummary(count) {
  if (count === 1) return "1 potential silent behaviour difference found";
  return `${count} potential silent behaviour differences found`;
}
