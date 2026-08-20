// Local-only conversion history + copy/download helpers.
//
// Everything here is browser-side. Nothing is sent anywhere, and history is
// deliberately capped so a few big pastes can never fill up localStorage.

const STORAGE_KEY = "codeshift.history.v1";
const PREFS_KEY = "codeshift.prefs.v1";

export const MAX_HISTORY = 12;

// Per-entry cap. localStorage is ~5MB total; a 12k-char paste plus its output
// is ~24k, so 12 entries is well inside budget even at worst case.
const MAX_STORED_CHARS = 14000;

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function canUseStorage() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    // Some browsers throw on localStorage access in private mode.
    return false;
  }
}

function readStorage(key) {
  try {
    if (!canUseStorage()) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function loadHistory() {
  const raw = readStorage(STORAGE_KEY);
  const list = safeParse(raw, []);
  if (!Array.isArray(list)) return [];
  // Entries must have both sides of the conversion to be restorable.
  // Filter defensively so a corrupted or partial entry never breaks the UI.
  return list.filter((e) => e && typeof e === "object" && e.inputCode && e.outputCode);
}

export function saveHistoryEntry(entry) {
  if (!canUseStorage()) return loadHistory();

  const trimmed = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    sourceLang: entry.sourceLang,
    targetLang: entry.targetLang,
    style: entry.style === "literal" ? "literal" : "idiomatic",
    inputCode: String(entry.inputCode || "").slice(0, MAX_STORED_CHARS),
    outputCode: String(entry.outputCode || "").slice(0, MAX_STORED_CHARS),
    explanation: Array.isArray(entry.explanation) ? entry.explanation.slice(0, 20) : [],
    pitfalls: Array.isArray(entry.pitfalls) ? entry.pitfalls.slice(0, 12) : [],
    schema: String(entry.schema || "").slice(0, 8000)
  };

  const existing = loadHistory();

  // Drop an identical previous run so re-running the same thing doesn't
  // push out other entries.
  // Style is part of the identity: the same code converted literally and
  // idiomatically are two different results worth keeping side by side.
  // Schema context is too: same code with different DDL is a different run.
  const deduped = existing.filter(
    (e) =>
      !(
        e.inputCode === trimmed.inputCode &&
        e.sourceLang === trimmed.sourceLang &&
        e.targetLang === trimmed.targetLang &&
        (e.style === "literal" ? "literal" : "idiomatic") === trimmed.style &&
        (e.schema || "") === trimmed.schema
      )
  );

  const next = [trimmed, ...deduped].slice(0, MAX_HISTORY);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    // Quota exceeded — keep only the newest few and try once more.
    const fallback = next.slice(0, 3);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
      return fallback;
    } catch {
      // Give up silently; history is a convenience, not core.
      // Return what we were able to persist (empty if nothing fit).
      try {
        const stored = loadHistory();
        return stored;
      } catch {
        return next;
      }
    }
  }
}

export function clearHistory() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function loadPrefs() {
  const raw = readStorage(PREFS_KEY);
  return safeParse(raw, {}) || {};
}

export function savePrefs(patch) {
  if (!canUseStorage()) return;
  try {
    const next = { ...loadPrefs(), ...patch };
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Download / comment helpers
// ---------------------------------------------------------------------------

const EXTENSIONS = {
  PostgreSQL: "sql",
  "Oracle SQL": "sql",
  "Snowflake SQL": "sql",
  "Google BigQuery": "sql",
  MySQL: "sql",
  Python: "py",
  "JavaScript / Node.js": "js",
  TypeScript: "ts",
  "Excel VBA": "bas",
  "C#": "cs",
  Java: "java",
  PHP: "php"
};

export function extensionFor(language) {
  return EXTENSIONS[language] || "txt";
}

// How to write a comment in each target language.
const COMMENT_STYLE = {
  sql: (line) => `-- ${line}`,
  py: (line) => `# ${line}`,
  bas: (line) => `' ${line}`
};

function commentFor(language) {
  const ext = extensionFor(language);
  return COMMENT_STYLE[ext] || ((line) => `// ${line}`);
}

/**
 * Prepend the explanation bullets as a comment header, in the target
 * language's own comment syntax so the result still compiles/runs.
 */
export function withComments({ code, explanation, sourceLang, targetLang }) {
  const comment = commentFor(targetLang);
  const bullets = Array.isArray(explanation) ? explanation : [];

  const header = [
    comment(`Converted from ${sourceLang} to ${targetLang} by CodeShift AI`),
    ...(bullets.length ? [comment("")] : []),
    ...bullets.map((b) => comment(`- ${b}`))
  ].join("\n");

  return `${header}\n\n${code}`;
}

/** Plain-text unified diff, for pasting into a PR or a chat message. */
export function asDiffText(rows) {
  return rows
    .map((row) => {
      if (row.type === "skip") return `@@ ${row.count} unchanged lines @@`;
      const sign = row.type === "added" ? "+" : row.type === "removed" ? "-" : " ";
      return `${sign}${row.text}`;
    })
    .join("\n");
}

export function downloadText(filename, text) {
  if (typeof window === "undefined") return;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Give the click a tick to register before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
