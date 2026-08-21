// Guards the Literal/Idiomatic toggle.
//
// The instruction builder lives inside the route handler (it needs no imports,
// so it stays there rather than becoming a lib just to be testable). We read
// the source and evaluate the self-contained instruction block.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../app/api/convert/route.js", import.meta.url), "utf8");
const block = src.slice(src.indexOf("const INSTRUCTION_HEAD"), src.indexOf("const STYLES"));

const { buildInstruction } = await import(
  "data:text/javascript," + encodeURIComponent(block + "\nexport { buildInstruction };")
);

test("idiomatic mode bans row-by-row iteration", () => {
  const out = buildInstruction("idiomatic");
  assert.ok(out.includes("df.iterrows()"), "should name iterrows as the thing to avoid");
  assert.ok(out.includes("np.select"), "should point at the vectorised alternative");
  assert.ok(out.includes("set-based"), "should cover SQL too");
});

test("literal mode does NOT ban loops — that is the whole point", () => {
  const out = buildInstruction("literal");
  assert.ok(
    !out.includes("df.iterrows()"),
    "literal must not carry the anti-iterrows rule, or it is just idiomatic again"
  );
  assert.ok(out.includes("Keep loops as loops"));
  assert.ok(out.includes("line-for-line"));
});

test("the two styles produce genuinely different instructions", () => {
  assert.notEqual(buildInstruction("idiomatic"), buildInstruction("literal"));
});

test("correctness guard survives in BOTH modes", () => {
  // A user picking "literal" is choosing structure, not switching off safety.
  for (const style of ["idiomatic", "literal"]) {
    const out = buildInstruction(style);
    assert.ok(out.includes("Correctness outranks style"), `${style} lost the guard`);
    assert.ok(out.includes("NULL handling"), `${style} lost the semantics list`);
  }
});

test("unknown or missing style falls back to idiomatic", () => {
  // An older cached client that posts no style must keep working after deploy.
  const idiomatic = buildInstruction("idiomatic");
  assert.equal(buildInstruction(undefined), idiomatic);
  assert.equal(buildInstruction(""), idiomatic);
  assert.equal(buildInstruction("LITERAL"), idiomatic, "case-sensitive by design");
  assert.equal(buildInstruction("nonsense"), idiomatic);
});

test("every style shares the same preamble", () => {
  for (const style of ["idiomatic", "literal"]) {
    assert.ok(buildInstruction(style).startsWith("You are an expert code and SQL migration engine."));
  }
});

// --- Schema-aware SQL conversion (DDL supplied) -----------------------------

const SQL_SCHEMA = { sqlConversion: true, hasSchema: true };

test("schema + SQL conversion treats the DDL as authoritative ground truth", () => {
  const out = buildInstruction("idiomatic", SQL_SCHEMA);
  assert.ok(out.includes("expert SQL dialect migration engine"), "gets the SQL expert identity");
  assert.ok(out.includes("authoritative ground truth"), "DDL is declared ground truth");
});

test("schema rules mandate precise type mapping with precision and scale", () => {
  const out = buildInstruction("idiomatic", SQL_SCHEMA);
  assert.ok(out.includes("NUMBER(p, s)"), "keeps precision/scale mappings explicit");
  assert.ok(out.includes("VARCHAR2(n)"), "maps sized string types");
  assert.ok(out.includes("NOT NULL column stays NOT NULL"), "nullability is carried over");
  assert.ok(out.includes("never ignore precision or scale"), "precision loss is forbidden");
});

test("schema rules enforce column existence and constraint respect", () => {
  const out = buildInstruction("idiomatic", SQL_SCHEMA);
  assert.ok(out.includes("Only reference columns that exist in"), "no invented columns");
  assert.ok(out.includes("PRIMARY KEY"), "constraints are named");
  assert.ok(out.includes("FOREIGN KEY"), "foreign keys are respected");
});

test("schema rules add schema-aware function rewriting guidance", () => {
  const out = buildInstruction("idiomatic", SQL_SCHEMA);
  assert.ok(out.includes("CURRENT_DATE over CURRENT_TIMESTAMP"), "DATE columns pick the right clock");
  assert.ok(out.includes("AGE()"), "year/month maths uses AGE/EXTRACT");
  assert.ok(out.includes("NVL / NVL2 / DECODE"), "Oracle conditionals are expanded");
  assert.ok(out.includes("avoid casts"), "no redundant casts");
});

test("pitfalls are re-checked against the schema but critical ones survive", () => {
  const out = buildInstruction("idiomatic", SQL_SCHEMA);
  assert.ok(out.includes("suppress or"), "schema-proven warnings get suppressed/downgraded");
  assert.ok(out.includes("ROWNUM vs LIMIT"), "ordering pitfall always survives");
  assert.ok(out.includes("empty string vs NULL"), "empty-string pitfall always survives");
  assert.ok(out.includes("time-zone handling"), "timezone pitfall always survives");
});

test("convertedCode must contain only SQL when a schema is supplied", () => {
  const out = buildInstruction("idiomatic", SQL_SCHEMA);
  assert.ok(out.includes("`convertedCode` contains only the converted SQL"));
  assert.ok(out.includes("preserve aliases and logical structure"));
});

test("schema rules stay out of non-SQL and schema-less conversions", () => {
  for (const out of [
    buildInstruction("idiomatic"),
    buildInstruction("idiomatic", {}),
    buildInstruction("idiomatic", { sqlConversion: false, hasSchema: true }),
    buildInstruction("literal", { sqlConversion: false, hasSchema: false })
  ]) {
    assert.ok(!out.includes("authoritative ground truth"), "ground-truth mode leaked");
    assert.ok(!out.includes("NUMBER(p, s)"), "type-mapping mandate leaked");
    assert.ok(!out.includes("No schema (DDL) was provided"), "no-schema fallback leaked");
  }
});

test("SQL conversion without a schema gets the conservative fallback", () => {
  const out = buildInstruction("idiomatic", { sqlConversion: true, hasSchema: false });
  assert.ok(out.includes("No schema (DDL) was provided"), "names the fallback");
  assert.ok(out.includes("conservative with type assumptions"), "stays conservative");
  assert.ok(out.includes("never"), "never invents precision or scale");
  assert.ok(!out.includes("authoritative ground truth"), "no ground-truth claim without a DDL");
});

test("literal mode keeps its structure mandate even with a schema", () => {
  const out = buildInstruction("literal", SQL_SCHEMA);
  assert.ok(out.includes("Keep loops as loops"), "literal structure survives");
  assert.ok(out.includes("authoritative ground truth"), "schema still applies");
  assert.ok(out.includes("Schema fidelity in literal mode"), "literal gets its own schema section");
  assert.ok(
    !out.includes("over a literal 1:1 translation"),
    "literal mode must not carry the idiomatic-quality override"
  );
});

test("idiomatic and literal stay different even with a schema", () => {
  assert.notEqual(
    buildInstruction("idiomatic", SQL_SCHEMA),
    buildInstruction("literal", SQL_SCHEMA)
  );
});
