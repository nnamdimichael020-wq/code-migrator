import test from "node:test";
import assert from "node:assert/strict";
import { collectIssues, issuesSummary } from "../issues.js";

test("empty conversion produces no issues", () => {
  assert.deepEqual(
    collectIssues({
      explanation: [],
      sourceLang: "Oracle SQL",
      targetLang: "PostgreSQL",
      inputCode: "",
      outputCode: "",
      modelPitfalls: []
    }),
    []
  );
});

test("a short SELECT that mentions ROWNUM picks up that trap only", () => {
  const issues = collectIssues({
    explanation: ["Replaced ROWNUM with LIMIT"],
    sourceLang: "Oracle SQL",
    targetLang: "PostgreSQL",
    inputCode: "SELECT * FROM employees WHERE ROWNUM <= 5",
    outputCode: "SELECT * FROM employees LIMIT 5",
    modelPitfalls: []
  });
  assert.ok(issues.length >= 1);
  assert.ok(issues.some((item) => /ROWNUM/i.test(item)));
  // Empty-string-is-NULL is a real Oracle trap but this paste never touches it.
  assert.ok(!issues.some((item) => /empty string/i.test(item)));
});

test("model pitfalls are listed first and de-duplicated", () => {
  const issues = collectIssues({
    explanation: [],
    sourceLang: "Python",
    targetLang: "JavaScript / Node.js",
    inputCode: "print(1)",
    outputCode: "console.log(1)",
    modelPitfalls: ["integer division differs", "integer division differs"]
  });
  assert.equal(issues[0], "integer division differs");
  assert.equal(issues.filter((item) => item === "integer division differs").length, 1);
});

test("summary grammar is correct", () => {
  assert.equal(issuesSummary(1), "1 potential silent behaviour difference found");
  assert.equal(issuesSummary(3), "3 potential silent behaviour differences found");
});

// --- Schema-proven suppression -------------------------------------------------

// The classic Oracle trap, triggered the way it triggers in production: the
// explanation mentions the dialects, so the gotcha's relevance tokens match.
const NULL_TOUCHING = {
  explanation: ["Replaced Oracle's empty-string handling for PostgreSQL."],
  sourceLang: "Oracle SQL",
  targetLang: "PostgreSQL",
  inputCode: "SELECT name FROM users WHERE name IS NULL OR name = ''",
  outputCode: "SELECT name FROM users WHERE name IS NULL OR name = ''",
  modelPitfalls: []
};

const ALL_CHAR_NOT_NULL_DDL = `CREATE TABLE users (
  id   NUMBER(10) NOT NULL,
  name VARCHAR2(100) NOT NULL,
  PRIMARY KEY (id)
);`;

const NULLABLE_CHAR_DDL = `CREATE TABLE users (
  id   NUMBER(10) NOT NULL,
  name VARCHAR2(100),
  PRIMARY KEY (id)
);`;

test("a DDL proving every character column NOT NULL drops the empty-string trap", () => {
  const withoutSchema = collectIssues({ ...NULL_TOUCHING });
  assert.ok(
    withoutSchema.some((item) => /empty string/i.test(item)),
    "precondition: the trap fires without a schema"
  );
  const withSchema = collectIssues({ ...NULL_TOUCHING, schemaText: ALL_CHAR_NOT_NULL_DDL });
  assert.ok(
    !withSchema.some((item) => /empty string/i.test(item)),
    "the schema disproves the trap, so it must not appear"
  );
});

test("a nullable character column keeps the empty-string trap", () => {
  const withSchema = collectIssues({ ...NULL_TOUCHING, schemaText: NULLABLE_CHAR_DDL });
  assert.ok(withSchema.some((item) => /empty string/i.test(item)));
});

test("schema suppression never touches traps it cannot disprove", () => {
  const runWith = (schemaText) =>
    collectIssues({
      explanation: ["Replaced Oracle's ROWNUM for PostgreSQL."],
      sourceLang: "Oracle SQL",
      targetLang: "PostgreSQL",
      inputCode: "SELECT * FROM employees WHERE ROWNUM <= 5",
      outputCode: "SELECT * FROM employees LIMIT 5",
      modelPitfalls: [],
      schemaText
    });
  for (const schemaText of [ALL_CHAR_NOT_NULL_DDL, NULLABLE_CHAR_DDL]) {
    assert.ok(
      runWith(schemaText).some((item) => /ROWNUM/i.test(item)),
      "ROWNUM ordering is schema-independent and must always stay"
    );
  }
});

test("unparseable schema text keeps every warning", () => {
  const issues = collectIssues({ ...NULL_TOUCHING, schemaText: "not a ddl at all" });
  assert.ok(issues.some((item) => /empty string/i.test(item)));
});
