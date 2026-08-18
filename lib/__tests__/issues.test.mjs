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
