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
