// A pragmatic CREATE TABLE parser used for schema-proven pitfall suppression.
//
// It is deliberately small: it does not try to understand the whole of DDL,
// only the facts the pitfall checks need — which character-typed columns
// exist, and whether the DDL proves them NOT NULL. When the parse can't prove
// anything, callers keep the warning (fail-open on the side of caution).

const CHAR_TYPES = new Set([
  "VARCHAR2", "NVARCHAR2", "VARCHAR", "NVARCHAR", "CHAR", "NCHAR",
  "CHARACTER", "STRING", "CLOB", "NCLOB", "TEXT"
]);

const CONSTRAINT_STARTERS = new Set([
  "CONSTRAINT", "PRIMARY", "UNIQUE", "FOREIGN", "CHECK", "KEY", "EXCLUDE",
  "LIKE", "INHERITS", "PARTITION", "CLUSTER", "ORGANIZATION", "PCTFREE",
  "PCTUSED", "INITRANS", "MAXTRANS", "STORAGE", "TABLESPACE", "LOGGING",
  "NOCOMPRESS", "COMPRESS", "COMMENT", "DEFAULT", "GRANT"
]);

function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(" ) depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function unquote(name) {
  return String(name || "").replace(/^["`\[]+|["`\]]+$/g, "").trim();
}

function parseColumn(def) {
  // "col_name TYPE(p,s) [DEFAULT x] [NOT NULL | NULL] [PRIMARY KEY]"
  // The body may itself contain commas (NUMBER(8,2)) — splitTopLevel already
  // handles comma separation, so the def body is matched without commas excluded.
  const m = def.match(
    /^(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w$#]*))\s+(.+)$/i
  );
  if (!m) return null;
  const name = unquote(m[1] || m[2] || m[3] || m[4]);
  const rest = m[5].trim();
  if (!name || CONSTRAINT_STARTERS.has(name.toUpperCase())) return null;

  const typeMatch = rest.match(/^([A-Za-z_]\w*)\s*(?:\(\s*(\d+)\s*(?:,\s*(-?\d+)\s*)?\))?/);
  if (!typeMatch) return null;
  const rawType = typeMatch[1].trim().toUpperCase();
  const base = rawType.split(/\s+/)[0];
  const precision = typeMatch[2] ? Number(typeMatch[2]) : null;
  const scale = typeMatch[3] !== undefined ? Number(typeMatch[3]) : null;
  const tail = rest.slice(typeMatch[0].length).toUpperCase();
  const notNull = /\bNOT\s+NULL\b/.test(tail) || /\bPRIMARY\s+KEY\b/.test(tail);
  const charType = CHAR_TYPES.has(base);

  return { name, base, rawType, precision, scale, nullable: !notNull, charType };
}

function parsePrimaryKeyColumns(body) {
  const pk = body.match(/primary\s+key\s*\(([^)]+)\)/i);
  if (!pk) return [];
  return pk[1].split(",").map((c) => unquote(c.trim()).toLowerCase()).filter(Boolean);
}

export function parseDdlColumns(schemaText) {
  const source = String(schemaText || "");
  const columns = [];
  const tables = [...source.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:["`\[]?)([\w$.]+)["`\]]?\s*\(([\s\S]*?)\)\s*(?:;|$|tablespace|pctfree|organization|partition|logging|storage)/gi)];
  for (const table of tables) {
    const tableName = unquote(table[1]);
    const body = table[2];
    const pkColumns = parsePrimaryKeyColumns(body);
    for (const def of splitTopLevel(body)) {
      const first = def.split(/[\s(]/)[0].toUpperCase();
      if (CONSTRAINT_STARTERS.has(first)) continue;
      const column = parseColumn(def);
      if (!column) continue;
      // PRIMARY KEY (col) in a table constraint implies NOT NULL for the column.
      if (pkColumns.includes(column.name.toLowerCase())) column.nullable = false;
      columns.push({ table: tableName, ...column });
    }
  }
  return { found: tables.length > 0, columns };
}

// True only when the DDL demonstrably covers the string world of the
// conversion AND every character column is NOT NULL — the one case where the
// classic "Oracle treats '' as NULL" pitfall is provably irrelevant.
export function charColumnsAllNotNull(schemaText) {
  const { found, columns } = parseDdlColumns(schemaText);
  if (!found) return false;
  const charColumns = columns.filter((c) => c.charType);
  return charColumns.length > 0 && charColumns.every((c) => !c.nullable);
}
