// Dependency-free line diff used by the "Diff" view.
//
// Classic LCS (longest common subsequence) over lines, then a walk back through
// the table to produce a unified list of rows. Input is capped at 200 lines by
// the API, so the O(n*m) table is small and this stays instant.

const MAX_LINES = 1200; // safety valve so a huge paste can never hang the tab

export function splitLines(text) {
  if (typeof text !== "string" || text === "") return [];
  return text.replace(/\r\n/g, "\n").replace(/\s+$/, "").split("\n");
}

// Ignore pure indentation/spacing noise when deciding if a line "changed",
// so a reformat does not light up the whole diff as red/green.
function normalize(line) {
  return line.trim().replace(/\s+/g, " ");
}

function buildLcsTable(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint32Array(rows * cols);

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const here = i * cols + j;
      if (normalize(a[i]) === normalize(b[j])) {
        table[here] = table[(i + 1) * cols + (j + 1)] + 1;
      } else {
        const down = table[(i + 1) * cols + j];
        const right = table[i * cols + (j + 1)];
        table[here] = down >= right ? down : right;
      }
    }
  }

  return { table, cols };
}

/**
 * Diff two blocks of text line by line.
 *
 * Returns an array of rows:
 *   { type: "same" | "removed" | "added", text, leftNumber, rightNumber }
 */
export function diffLines(before, after) {
  const a = splitLines(before);
  const b = splitLines(after);

  // Too big to diff comfortably — show both sides whole rather than freezing.
  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    return [
      ...a.map((text, i) => ({ type: "removed", text, leftNumber: i + 1, rightNumber: null })),
      ...b.map((text, i) => ({ type: "added", text, leftNumber: null, rightNumber: i + 1 }))
    ];
  }

  const { table, cols } = buildLcsTable(a, b);
  const rows = [];

  let i = 0;
  let j = 0;
  let leftNumber = 1;
  let rightNumber = 1;

  while (i < a.length && j < b.length) {
    if (normalize(a[i]) === normalize(b[j])) {
      // Prefer the target-side text so the reader sees the real output.
      rows.push({ type: "same", text: b[j], leftNumber: leftNumber++, rightNumber: rightNumber++ });
      i++;
      j++;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + (j + 1)]) {
      rows.push({ type: "removed", text: a[i], leftNumber: leftNumber++, rightNumber: null });
      i++;
    } else {
      rows.push({ type: "added", text: b[j], leftNumber: null, rightNumber: rightNumber++ });
      j++;
    }
  }

  while (i < a.length) {
    rows.push({ type: "removed", text: a[i++], leftNumber: leftNumber++, rightNumber: null });
  }

  while (j < b.length) {
    rows.push({ type: "added", text: b[j++], leftNumber: null, rightNumber: rightNumber++ });
  }

  return rows;
}

export function countChanges(rows) {
  let added = 0;
  let removed = 0;
  for (const row of rows) {
    if (row.type === "added") added++;
    else if (row.type === "removed") removed++;
  }
  return { added, removed };
}

/**
 * Collapse long runs of unchanged lines into a single marker so the eye lands
 * on what actually changed. `context` unchanged lines are kept either side.
 */
export function collapseUnchanged(rows, context = 2) {
  const keep = new Array(rows.length).fill(false);

  rows.forEach((row, index) => {
    if (row.type === "same") return;
    for (let k = index - context; k <= index + context; k++) {
      if (k >= 0 && k < rows.length) keep[k] = true;
    }
  });

  const out = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    if (keep[index]) {
      if (skipped > 0) {
        out.push({ type: "skip", count: skipped });
        skipped = 0;
      }
      out.push(row);
    } else {
      skipped++;
    }
  });

  if (skipped > 0) out.push({ type: "skip", count: skipped });

  return out;
}
