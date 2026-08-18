import test from "node:test";
import assert from "node:assert/strict";
import { getAllPages, getPair, MODIFIERS, PAIRS, relatedPages } from "../pairs.js";

const ALLOWED = [
  "PostgreSQL",
  "Oracle SQL",
  "Snowflake SQL",
  "Google BigQuery",
  "MySQL",
  "Python",
  "JavaScript / Node.js",
  "TypeScript",
  "Excel VBA",
  "C#",
  "Java",
  "PHP"
];

test("every page uses languages the converter actually supports", () => {
  for (const page of getAllPages()) {
    assert.ok(ALLOWED.includes(page.source), `${page.slug} source ${page.source}`);
    assert.ok(ALLOWED.includes(page.target), `${page.slug} target ${page.target}`);
  }
});

test("slugs are unique across pairs and modifiers", () => {
  const slugs = getAllPages().map((p) => p.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("getPair finds both core pairs and modifiers", () => {
  assert.equal(getPair("oracle-to-postgresql").source, "Oracle SQL");
  assert.equal(getPair("oracle-sql-silent-traps").title, "Oracle SQL Silent Traps");
  assert.equal(getPair("excel-vba-to-python-microservice").target, "Python");
  assert.equal(getPair("does-not-exist"), null);
});

test("modifiers stay thin: mapping table + at least 3 traps + an example", () => {
  assert.ok(MODIFIERS.length >= 8 && MODIFIERS.length <= 15, `got ${MODIFIERS.length}`);
  for (const page of MODIFIERS) {
    assert.ok(page.mappings.length >= 5, `${page.slug} mappings`);
    assert.ok(page.gotchas.length >= 3, `${page.slug} gotchas`);
    assert.ok(page.example?.before && page.example?.after, `${page.slug} example`);
    assert.ok(PAIRS.some((p) => p.slug === page.parent), `${page.slug} parent`);
  }
});

test("relatedPages links a modifier back to its parent pair", () => {
  const related = relatedPages("oracle-sql-silent-traps");
  assert.ok(related.some((p) => p.slug === "oracle-to-postgresql"));
});

test("C# is never left raw in a URL slug", () => {
  for (const page of getAllPages()) {
    assert.ok(!page.slug.includes("#"));
  }
});
