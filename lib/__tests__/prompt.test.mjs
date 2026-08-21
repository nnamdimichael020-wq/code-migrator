// Guards the conversion engine's system prompt (lib/prompt.js).
//
// The prompt is the product for schema-backed conversions: every rule here
// pins a behaviour the Schema feature depends on — DDL authority, type
// mapping with precision/scale, nullability-driven rewrites, schema-checked
// pitfall suppression, and a fallback mode that stays honest without a DDL.

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSystemInstruction,
  buildConversionInput,
  isSqlConversion
} from "../prompt.js";

const ORACLE_PG = { sourceLang: "Oracle SQL", targetLang: "PostgreSQL" };

const schemaMode = (style = "idiomatic") =>
  buildSystemInstruction({ ...ORACLE_PG, style, hasSchema: true });

// --- Style axis (kept from the original toggle guarantees) ------------------

test("idiomatic mode bans row-by-row iteration", () => {
  const out = schemaMode("idiomatic");
  assert.ok(out.includes("df.iterrows()"));
  assert.ok(out.includes("np.select"));
  assert.ok(out.includes("set-based"));
});

test("literal mode does NOT ban loops — that is the whole point", () => {
  const out = schemaMode("literal");
  assert.ok(!out.includes("df.iterrows()"));
  assert.ok(out.includes("Keep loops as loops"));
  assert.ok(out.includes("line-for-line"));
});

test("the two styles produce genuinely different instructions", () => {
  for (const hasSchema of [true, false]) {
    assert.notEqual(
      buildSystemInstruction({ ...ORACLE_PG, style: "idiomatic", hasSchema }),
      buildSystemInstruction({ ...ORACLE_PG, style: "literal", hasSchema })
    );
  }
});

test("correctness guard survives in BOTH modes", () => {
  for (const style of ["idiomatic", "literal"]) {
    const out = schemaMode(style);
    assert.ok(out.includes("Correctness outranks style"), `${style} lost the guard`);
    assert.ok(out.includes("NULL handling"), `${style} lost the semantics list`);
  }
});

test("any style other than literal reads as idiomatic", () => {
  const idiomatic = schemaMode("idiomatic");
  assert.equal(schemaMode(undefined), idiomatic);
  assert.equal(schemaMode("nonsense"), idiomatic);
});

// --- Schema-backed SQL mode: the requirements -------------------------------

test("DDL is declared authoritative ground truth", () => {
  const out = schemaMode();
  assert.ok(out.includes("authoritative ground truth"));
  assert.ok(out.includes("DDL beats code"), "conflicts resolve toward the DDL");
  assert.ok(out.includes("Resolve before you translate"), "lookups happen first");
});

test("type mapping keeps precision and scale, with integer thresholds", () => {
  const out = schemaMode();
  assert.ok(out.includes("NUMERIC(p,s)"), "NUMBER(p,s) maps exactly");
  assert.ok(out.includes("SMALLINT if p <= 4"));
  assert.ok(out.includes("INTEGER if p <= 9"));
  assert.ok(out.includes("BIGINT if p <= 18"));
  assert.ok(out.includes("VARCHAR2(n), NVARCHAR2(n)"), "sized strings map");
  assert.ok(out.includes("VARCHAR(n)"));
  assert.ok(out.includes("never widen or drop them"), "precision is sacred");
});

test("bare NUMBER defaults to NUMERIC unless the DDL proves integers", () => {
  const out = schemaMode();
  assert.ok(/NUMBER with no precision[\s\S]{0,200}NUMERIC by default/.test(out));
  assert.ok(out.includes("key/identity"), "integer only on evidence");
});

test("nullability drives rewrites: NOT NULL kills dead NVL code", () => {
  const out = schemaMode();
  assert.ok(out.includes("NVL(col, x)"), "the dead-code rule is spelled out");
  assert.ok(out.includes("dead code"));
  assert.ok(out.includes("NOT NULL"), "nullability is carried from the DDL");
  assert.ok(out.includes("ON CONFLICT"), "PK/UNIQUE feeds the conflict target");
});

test("DATE rule prefers CURRENT_DATE but keeps time when it is load-bearing", () => {
  const out = schemaMode();
  assert.ok(out.includes("CURRENT_DATE (not CURRENT_TIMESTAMP)"), "date-only uses CURRENT_DATE");
  assert.ok(out.includes("NOW()/CURRENT_TIMESTAMP"), "time-carrying keeps the clock");
  assert.ok(out.includes("silently truncate"), "time loss is called out");
});

test("function rewrites are chosen by the ACTUAL column type", () => {
  const out = schemaMode();
  assert.ok(out.includes("timestamp_col + interval '1 day'"), "date arithmetic is typed");
  assert.ok(out.includes("date_col + 1"), "DATE + int stays valid");
  assert.ok(out.includes("string_agg"), "LISTAGG target is named");
  assert.ok(out.includes("ROW_NUMBER() OVER ()"), "projected ROWNUM has a form");
  assert.ok(out.includes("make_interval"), "ADD_MONTHS has a native form");
  assert.ok(out.includes("end-of-month"), "the ADD_MONTHS trap is named");
  assert.ok(out.includes("::numeric"), "implicit casts become explicit");
});

test("pitfall warnings must survive a schema check", () => {
  const out = schemaMode();
  assert.ok(out.includes("survive a schema check"), "suppression policy is mandatory");
  assert.ok(out.includes("proved safe"), "dropped warnings are reported once");
  assert.ok(out.includes("ROWNUM vs LIMIT"), "undisprovable traps always stay");
  assert.ok(out.includes("ADD_MONTHS"), "end-of-month trap always stays");
  assert.ok(out.includes("timezone"));
});

test("the model is told never to re-emit the DDL", () => {
  const out = schemaMode();
  assert.ok(out.includes("Convert only the code"));
  assert.ok(out.includes("Never translate, echo, or re-emit"));
});

test("literal + schema keeps structure but not guessed types", () => {
  const out = schemaMode("literal");
  assert.ok(out.includes("Keep loops as loops"));
  assert.ok(out.includes("authoritative ground truth"));
  assert.ok(out.includes("literal means structure-preserving, not guessed"));
});

// --- Fallback mode (no DDL) --------------------------------------------------

test("SQL without a DDL gets the conservative fallback", () => {
  const out = buildSystemInstruction({ ...ORACLE_PG, style: "idiomatic" });
  assert.ok(out.includes("FALLBACK MODE"), "names the mode");
  assert.ok(out.includes("No schema (DDL) was provided"));
  assert.ok(out.includes("cannot lose information"), "picks lossless types");
  assert.ok(out.includes("Never invent precision"), "no made-up precision");
  assert.ok(out.includes("assumption"), "assumptions are named");
  assert.ok(!out.includes("authoritative ground truth"), "no ground-truth claim without a DDL");
});

test("schema rules stay out of non-SQL conversions", () => {
  for (const out of [
    buildSystemInstruction({ sourceLang: "Python", targetLang: "JavaScript / Node.js" }),
    buildSystemInstruction({ sourceLang: "Excel VBA", targetLang: "Python", hasSchema: true })
  ]) {
    assert.ok(!out.includes("authoritative ground truth"), "ground-truth mode leaked");
    assert.ok(!out.includes("SMALLINT if p <= 4"), "type table leaked");
    assert.ok(!out.includes("FALLBACK MODE"), "SQL fallback leaked");
  }
});

test("non-SQL conversions with a schema get the context note, not SQL rules", () => {
  const out = buildSystemInstruction({
    sourceLang: "Excel VBA", targetLang: "Python", hasSchema: true
  });
  assert.ok(out.includes("data layout"), "schema is acknowledged");
  assert.ok(out.includes("do not translate or re-emit"));
  assert.ok(!out.includes("NUMERIC(p,s)"), "SQL type table must not appear");
});

test("isSqlConversion covers every SQL dialect pairing", () => {
  assert.ok(isSqlConversion("Oracle SQL", "PostgreSQL"));
  assert.ok(isSqlConversion("MySQL", "Snowflake SQL"));
  assert.ok(!isSqlConversion("Python", "TypeScript"));
});

// --- Input builder ------------------------------------------------------------

test("input builder delimits code and DDL so neither bleeds into the other", () => {
  const input = buildConversionInput({
    ...ORACLE_PG,
    code: "SELECT 1 FROM dual",
    schemaText: "CREATE TABLE t (a NUMBER)"
  });
  assert.ok(input.includes("=== SOURCE Oracle SQL (convert this) ==="));
  assert.ok(input.includes("=== END SOURCE ==="));
  assert.ok(input.includes("=== TABLE DDL"));
  assert.ok(input.includes("Reference only: do not convert or re-emit"));
  assert.ok(input.indexOf("SELECT 1 FROM dual") < input.indexOf("=== TABLE DDL"), "code comes first");
});

test("input builder omits the DDL block when there is no schema", () => {
  const input = buildConversionInput({ ...ORACLE_PG, code: "SELECT 1" });
  assert.ok(!input.includes("TABLE DDL"));
  assert.ok(!input.includes("authoritative"));
});

test("whitespace-only schema is treated as absent", () => {
  const withBlank = buildConversionInput({ ...ORACLE_PG, code: "SELECT 1", schemaText: "   \n " });
  const without = buildConversionInput({ ...ORACLE_PG, code: "SELECT 1" });
  assert.equal(withBlank, without);
});
