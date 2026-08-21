// Guards the pragmatic DDL parser that powers schema-proven pitfall
// suppression. Parsing is allowed to fail — it must only ever suppress a
// warning on actual proof, never on a hopeful half-parse.

import test from "node:test";
import assert from "node:assert/strict";
import { parseDdlColumns, charColumnsAllNotNull } from "../schema.js";

const EMPLOYEES_DDL = `
CREATE TABLE employees (
  emp_id     NUMBER(10) NOT NULL,
  full_name  VARCHAR2(200 CHAR) NOT NULL,
  bonus      NUMBER(8,2),
  hired_at   DATE NOT NULL,
  bio        CLOB,
  CONSTRAINT pk_emp PRIMARY KEY (emp_id)
);`;

test("parses tables, columns, precision and scale", () => {
  const { found, columns } = parseDdlColumns(EMPLOYEES_DDL);
  assert.ok(found);
  const byName = Object.fromEntries(columns.map((c) => [c.name, c]));
  assert.equal(byName.emp_id.base, "NUMBER");
  assert.equal(byName.emp_id.nullable, false, "explicit NOT NULL");
  assert.equal(byName.bonus.precision, 8);
  assert.equal(byName.bonus.scale, 2);
  assert.equal(byName.bonus.nullable, true, "no NOT NULL clause");
  assert.equal(byName.full_name.base, "VARCHAR2");
  assert.ok(byName.full_name.charType);
  assert.equal(byName.hired_at.base, "DATE");
});

test("PRIMARY KEY constraint implies NOT NULL on its columns", () => {
  const ddl = `CREATE TABLE codes (
    code  VARCHAR2(10),
    label VARCHAR2(100) NOT NULL,
    PRIMARY KEY (code)
  )`;
  const { columns } = parseDdlColumns(ddl);
  const code = columns.find((c) => c.name === "code");
  assert.equal(code.nullable, false, "PK column is not nullable");
});

test("charColumnsAllNotNull requires proof, not absence", () => {
  // Nullable CLOB present -> cannot disprove the '' vs NULL pitfall.
  assert.equal(charColumnsAllNotNull(EMPLOYEES_DDL), false);
  // Every character column NOT NULL (one explicit, one via PK) -> proven.
  const proven = `CREATE TABLE codes (
    code  VARCHAR2(10),
    label VARCHAR2(100) NOT NULL,
    PRIMARY KEY (code)
  )`;
  assert.equal(charColumnsAllNotNull(proven), true);
});

test("garbage or non-DDL input never claims proof", () => {
  assert.equal(charColumnsAllNotNull("hello world"), false);
  assert.equal(charColumnsAllNotNull(""), false);
  assert.equal(charColumnsAllNotNull("SELECT * FROM nowhere"), false);
});
