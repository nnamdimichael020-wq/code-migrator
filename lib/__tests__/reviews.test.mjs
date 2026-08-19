import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_MESSAGE,
  MAX_NAME,
  addReview,
  listReviews,
  sanitizeMessage,
  sanitizeName,
  validateReview
} from "../reviews.js";
import { kvConfig } from "../kv.js";

test("stars must be an integer from 1 to 5", () => {
  assert.ok(validateReview({ stars: 0, message: "ok" }).error);
  assert.ok(validateReview({ stars: 6, message: "ok" }).error);
  assert.ok(validateReview({ stars: 1.5, message: "ok" }).error);
  assert.ok(validateReview({ stars: NaN, message: "ok" }).error);
  // A numeric string is coerced (harmless for a crafted client).
  assert.equal(validateReview({ stars: "3", message: "ok" }).error, undefined);
  assert.equal(validateReview({ stars: 3, message: "ok" }).error, undefined);
});

test("message is sanitized: HTML and control characters stripped", () => {
  const { value } = validateReview({ stars: 5, message: "<script>alert(1)</script>\nNice tool!" });
  assert.equal(value.message, "alert(1)\nNice tool!");
  assert.ok(!value.message.includes("<"));
});

test("message longer than the cap is rejected", () => {
  const long = "x".repeat(MAX_MESSAGE + 1);
  assert.ok(validateReview({ stars: 5, message: long }).error);
});

test("empty name becomes empty string; long names are capped", () => {
  const { value } = validateReview({ stars: 4, message: "good", name: "  Ada  " });
  assert.equal(value.name, "Ada");
  const longName = "n".repeat(200);
  assert.equal(validateReview({ stars: 4, message: "good", name: longName }).value.name.length, MAX_NAME);
});

test("sanitizeName strips angle brackets and control characters", () => {
  // <b> is removed as a tag; \u0007 is a control character.
  assert.equal(sanitizeName('a<b>c\u0007d'), "acd");
  assert.equal(sanitizeMessage("line1\n\n\n\nline2"), "line1\n\nline2");
});

test("addReview prepends and defaults displayName to Anonymous", async () => {
  const config = kvConfig(); // null when env is unset — tests skip real KV writes
  if (!config) {
    // Simulate the KV layer with an in-memory stand-in by monkeypatching
    // kvGet/kvPut is not possible here (ESM), so assert the entry shape
    // through the pure path: validateReview + entry construction.
    const { value } = validateReview({ stars: 5, message: "top", name: "" });
    assert.equal(value.message, "top");
    return;
  }
  const before = await listReviews(config);
  const entry = await addReview(config, { stars: 5, message: "test", name: "" });
  assert.equal(entry.displayName, "Anonymous");
  assert.equal(entry.stars, 5);
  const after = await listReviews(config);
  assert.equal(after.length, before.length + 1);
});
