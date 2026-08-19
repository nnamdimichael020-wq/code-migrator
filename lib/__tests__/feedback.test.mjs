import test from "node:test";
import assert from "node:assert/strict";
import {
  FEEDBACK_CATEGORIES,
  feedbackBody,
  feedbackSubject,
  sendFeedbackEmail,
  validateFeedback
} from "../feedback.js";

test("valid feedback passes and is sanitized", () => {
  const { value, error } = validateFeedback({
    name: " Ada Lovelace ",
    email: "ADA@Example.com",
    category: "Issue",
    note: "  The converter dropped my ORDER BY.\nPlease fix.  "
  });
  assert.equal(error, undefined);
  assert.equal(value.name, "Ada Lovelace");
  assert.equal(value.email, "ada@example.com"); // lowercased
  assert.ok(value.note.startsWith("The converter"));
});

test("missing name, bad email, bad category, empty note are rejected", () => {
  const base = { name: "Ada", email: "ada@example.com", category: "Issue", note: "hi" };
  assert.ok(validateFeedback({ ...base, name: "" }).error);
  assert.ok(validateFeedback({ ...base, name: "  " }).error);
  assert.ok(validateFeedback({ ...base, email: "not-an-email" }).error);
  assert.ok(validateFeedback({ ...base, category: "Billing" }).error);
  assert.ok(validateFeedback({ ...base, note: "" }).error);
  assert.equal(validateFeedback(base).error, undefined);
});

test("note longer than the cap is rejected", () => {
  const base = { name: "Ada", email: "ada@example.com", category: "Issue" };
  assert.ok(validateFeedback({ ...base, note: "x".repeat(2001) }).error);
});

test("HTML in the note is stripped", () => {
  const { value } = validateFeedback({
    name: "Ada",
    email: "ada@example.com",
    category: "Other",
    note: "<b>bold</b> note"
  });
  assert.equal(value.note, "bold note");
});

test("subject matches the required format", () => {
  assert.equal(
    feedbackSubject({ category: "Missing feature", name: "Ada" }),
    "[CodeShift Feedback] Missing feature from Ada"
  );
});

test("body contains all fields and a timestamp", () => {
  const body = feedbackBody({
    name: "Ada",
    email: "ada@example.com",
    category: "Issue",
    note: "hello"
  });
  assert.ok(body.includes("Name: Ada"));
  assert.ok(body.includes("Email: ada@example.com"));
  assert.ok(body.includes("Category: Issue"));
  assert.ok(body.includes("hello"));
  assert.match(body, /Sent: \d{4}-\d{2}-\d{2}T/);
});

test("unconfigured provider fails gracefully, does not pretend to send", async () => {
  // Tests run without RESEND_API_KEY / DEVELOPER_EMAIL set.
  const result = await sendFeedbackEmail({
    name: "Ada",
    email: "ada@example.com",
    category: "Issue",
    note: "hello"
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /not configured/i);
});

test("every category is a non-empty string", () => {
  assert.ok(FEEDBACK_CATEGORIES.length >= 5);
  for (const c of FEEDBACK_CATEGORIES) assert.ok(c.length > 0);
});
