// Group the AI's explanation bullets into categories, locally.
//
// This is deliberately NOT a confidence score. See the note at the bottom of
// this file for why. Categories are derived from keywords in the bullet text,
// which is honest about what it is: a sorting aid, not a judgement.

const CATEGORIES = [
  {
    id: "function",
    label: "Function rewrites",
    hint: "A built-in function was swapped for the target's equivalent.",
    patterns: [
      /\bfunction\b/i, /\breplac\w+\b/i, /\bNVL\b/i, /\bCOALESCE\b/i, /\bISNULL\b/i,
      /\bDECODE\b/i, /\bSUBSTR\w*\b/i, /\bTO_CHAR\b/i, /\bTO_DATE\b/i, /\bCONCAT\b/i,
      /\bIFNULL\b/i, /\bequivalent\b/i
    ]
  },
  {
    id: "limit",
    label: "Row limiting / paging",
    hint: "How the query restricts the number of rows returned.",
    patterns: [/\bROWNUM\b/i, /\bLIMIT\b/i, /\bTOP\b/i, /\bFETCH FIRST\b/i, /\bOFFSET\b/i, /\bpagination\b/i]
  },
  {
    id: "datetime",
    label: "Dates & times",
    hint: "Date handling differs a lot between dialects — worth a close look.",
    patterns: [/\bSYSDATE\b/i, /\bNOW\(\)/i, /\bCURRENT_(DATE|TIMESTAMP)\b/i, /\bGETDATE\b/i,
      /\bdate\b/i, /\btimestamp\b/i, /\binterval\b/i, /\btimezone\b/i]
  },
  {
    id: "types",
    label: "Data types",
    hint: "A column or variable type was mapped to a different type.",
    patterns: [/\btype\b/i, /\bVARCHAR2?\b/i, /\bNUMBER\b/i, /\bNUMERIC\b/i, /\bTEXT\b/i,
      /\bINT\w*\b/i, /\bBOOLEAN\b/i, /\bcast\b/i, /\bCLOB\b/i, /\bBLOB\b/i]
  },
  {
    id: "structure",
    label: "Structure & control flow",
    hint: "Loops, blocks, procedures or error handling were restructured.",
    patterns: [/\bloop\b/i, /\bcursor\b/i, /\bprocedure\b/i, /\bfunction block\b/i,
      /\bexception\b/i, /\btry\b/i, /\bcatch\b/i, /\bif\b/i, /\bindentation\b/i,
      /\bstructur\w+\b/i, /\bblock\b/i]
  },
  {
    id: "syntax",
    label: "Syntax & keywords",
    hint: "Keyword, quoting or operator differences.",
    patterns: [/\bsyntax\b/i, /\bkeyword\b/i, /\bquot\w+\b/i, /\boperator\b/i,
      /\bsemicolon\b/i, /\bidentifier\b/i, /\bcase.sensitiv\w*\b/i, /\balias\b/i]
  }
];

const FALLBACK = {
  id: "other",
  label: "Other changes",
  hint: "Everything else the model called out."
};

/**
 * Bucket explanation bullets into categories.
 * Returns [{ id, label, hint, items: [...] }] with empty groups removed,
 * preserving the original bullet order within each group.
 */
export function groupExplanation(explanation) {
  const bullets = Array.isArray(explanation) ? explanation.filter(Boolean) : [];
  if (bullets.length === 0) return [];

  const buckets = new Map();

  for (const bullet of bullets) {
    const text = String(bullet);
    const match = CATEGORIES.find((cat) => cat.patterns.some((p) => p.test(text)));
    const cat = match || FALLBACK;

    if (!buckets.has(cat.id)) {
      buckets.set(cat.id, { id: cat.id, label: cat.label, hint: cat.hint, items: [] });
    }
    buckets.get(cat.id).items.push(text);
  }

  // Keep a stable, meaningful order rather than insertion order.
  const order = [...CATEGORIES.map((c) => c.id), FALLBACK.id];
  return order.filter((id) => buckets.has(id)).map((id) => buckets.get(id));
}

/**
 * Flag changes that are commonly wrong in migrations and deserve a human eye.
 * This is a heuristic prompt to review, NOT a claim about correctness.
 */
const REVIEW_FLAGS = [
  { test: /\btimezone\b|\bSYSDATE\b|\bCURRENT_TIMESTAMP\b/i, why: "timezone behaviour differs between dialects" },
  { test: /\bROWNUM\b/i, why: "ROWNUM applies before ORDER BY in Oracle; LIMIT applies after" },
  { test: /\bNULL\b/i, why: "NULL sorting and comparison rules vary" },
  { test: /\bdivision\b|\binteger division\b/i, why: "integer vs float division differs" },
  { test: /\bimplicit\b|\bautomatic\b/i, why: "implicit conversions are not portable" }
];

export function reviewNotes(explanation) {
  const bullets = Array.isArray(explanation) ? explanation.filter(Boolean) : [];
  const hits = [];
  for (const flag of REVIEW_FLAGS) {
    if (bullets.some((b) => flag.test.test(String(b)))) hits.push(flag.why);
  }
  return hits;
}

// A note on "confidence scores":
//
// A number like "92% confident" would have to come from somewhere. The model
// does not return calibrated probabilities, and inventing one from keyword
// counts would be a fabricated number attached to code someone may ship to
// production. That is worse than showing nothing. Categories and explicit
// "check this" flags give the user the same benefit — knowing where to look —
// without pretending to a precision we do not have.
