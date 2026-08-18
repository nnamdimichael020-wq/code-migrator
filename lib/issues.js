// Visible "silent issues" signal after a conversion.
//
// This is not a confidence score. It merges three honest sources:
//   1. pitfalls the model returned for THIS conversion
//   2. keyword flags in the explanation (timezone, ROWNUM, NULL, …)
//   3. known pair-level traps that actually appear in the pasted code
//
// Pair gotchas that have nothing to do with the paste stay out of the count
// so a three-line SELECT does not claim "7 issues found".

import { pairGotchas } from "./pairs.js";
import { reviewNotes } from "./classify.js";

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
  modelPitfalls = []
} = {}) {
  const fromModel = (Array.isArray(modelPitfalls) ? modelPitfalls : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const fromKeywords = reviewNotes(explanation);
  const haystack = haystackOf({ explanation, inputCode, outputCode });
  const fromPair = relevantPairGotchas(sourceLang, targetLang, haystack);

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
