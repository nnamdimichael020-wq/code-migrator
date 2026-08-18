import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_MAX_LINES,
  SIZE_LIMIT_CODE,
  inspectPaste,
  sizeLimitPayload
} from "../limits.js";

test("a short snippet is neither too long nor a batch", () => {
  const info = inspectPaste("SELECT * FROM employees WHERE ROWNUM <= 5");
  assert.equal(info.tooLong, false);
  assert.equal(info.multiStatement, false);
  assert.ok(info.lineCount >= 1);
});

test("more than 200 lines is too long", () => {
  const info = inspectPaste(Array.from({ length: 201 }, (_, i) => `-- ${i}`).join("\n"));
  assert.equal(info.tooLong, true);
  assert.equal(info.lineCount, 201);
});

test("three SQL statements count as a batch, but still convert if short", () => {
  const info = inspectPaste(`SELECT 1 FROM dual;
SELECT 2 FROM dual;
SELECT 3 FROM dual;`);
  assert.equal(info.tooLong, false);
  assert.equal(info.multiStatement, true);
  assert.ok(info.statementCount >= 3);
});

test("comments are not counted as statements", () => {
  const info = inspectPaste(`-- SELECT decoy
SELECT 1 FROM dual`);
  assert.equal(info.multiStatement, false);
});

test("size-limit payload is what the UI keys off", () => {
  const payload = sizeLimitPayload(512);
  assert.equal(payload.code, SIZE_LIMIT_CODE);
  assert.match(payload.error, /512 lines/);
  assert.match(payload.error, new RegExp(String(FREE_MAX_LINES)));
});
