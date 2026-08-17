// Data for the static conversion pages, and the source of dialect-specific
// review notes.
//
// Each pair carries real syntax mappings, real gotchas, and one complete
// before/after example. These pages exist to be genuinely useful on their own
// — a developer should be able to solve their problem from the table without
// ever running a conversion. That is also what makes them worth linking to.
//
// `example.before` / `example.after` are rendered through the same diff engine
// the live tool uses, at build time. No model call, no runtime cost.
// Bump this when the mappings, gotchas or examples below are revised.
export const LAST_UPDATED = "2026-08-17";
export const PAIRS = [
  {
    slug: "oracle-to-postgresql",
    source: "Oracle SQL",
    target: "PostgreSQL",
    blurb:
      "Oracle to PostgreSQL is the most common enterprise migration, usually driven by licensing cost. Most queries port cleanly; the traps are row limiting, date handling and empty-string semantics.",
    mappings: [
      ["NVL(x, y)", "COALESCE(x, y)"],
      ["NVL2(x, a, b)", "CASE WHEN x IS NOT NULL THEN a ELSE b END"],
      ["SYSDATE", "CURRENT_DATE or NOW()"],
      ["ROWNUM <= 10", "LIMIT 10"],
      ["DECODE(a, b, c, d)", "CASE WHEN a = b THEN c ELSE d END"],
      ["LISTAGG(x, ',') WITHIN GROUP (ORDER BY y)", "STRING_AGG(x, ',' ORDER BY y)"],
      ["a.id = b.id (+)", "LEFT JOIN b ON a.id = b.id"],
      ["ADD_MONTHS(d, 3)", "d + INTERVAL '3 months'"],
      ["MONTHS_BETWEEN(a, b)", "manual: EXTRACT from AGE(a, b)"],
      ["MERGE INTO t USING ...", "INSERT ... ON CONFLICT ... DO UPDATE"],
      ["SUBSTR(s, 1, 3)", "SUBSTRING(s FROM 1 FOR 3)"],
      ["INSTR(s, 'x')", "POSITION('x' IN s)"],
      ["TRUNC(d)", "DATE_TRUNC('day', d)"],
      ["SYS_GUID()", "gen_random_uuid()"],
      ["seq.NEXTVAL", "nextval('seq')"],
      ["CONNECT BY PRIOR", "WITH RECURSIVE"],
      ["TO_CHAR(d, 'YYYY-MM-DD')", "TO_CHAR(d, 'YYYY-MM-DD')"],
      ["VARCHAR2(n)", "VARCHAR(n)"],
      ["NUMBER(p, s)", "NUMERIC(p, s)"],
      ["CLOB", "TEXT"],
      ["DUAL", "(omit the FROM clause entirely)"],
      ["|| for concat", "|| (same)"],
      ["MINUS", "EXCEPT"]
    ],
    gotchas: [
      "ROWNUM is applied BEFORE ORDER BY in Oracle, but LIMIT is applied AFTER in PostgreSQL. A naive ROWNUM to LIMIT swap can silently return different rows.",
      "Oracle treats an empty string '' as NULL. PostgreSQL does not. Any IS NULL check on a text column can change behaviour.",
      "Oracle identifiers are case-insensitive unless quoted; PostgreSQL folds unquoted names to lowercase. Mixed-case quoted names must stay quoted.",
      "SYSDATE returns a DATE with a time component in Oracle. CURRENT_DATE in PostgreSQL has no time. Use NOW() if you need the time.",
      "Oracle implicitly casts between strings and numbers, so WHERE id = '42' works on a numeric column. PostgreSQL raises a type error instead — these surface as failures only on the code paths that run.",
      "Concatenating NULL differs: because Oracle treats '' as NULL, 'a' || NULL returns 'a' in Oracle but NULL in PostgreSQL. Any built-up string containing an optional column can silently become NULL.",
      "Oracle's TIMESTAMP WITH LOCAL TIME ZONE normalises to the session time zone on read. PostgreSQL's TIMESTAMPTZ stores UTC and converts on display. Mapping either onto a plain TIMESTAMP quietly drops the time-zone handling."
    ],
    example: {
      title: "Aggregating with LISTAGG and an outer join",
      before: `SELECT d.dept_name,
       LISTAGG(e.emp_name, ', ')
         WITHIN GROUP (ORDER BY e.emp_name) AS staff,
       NVL(COUNT(e.emp_id), 0) AS headcount
FROM   departments d, employees e
WHERE  d.dept_id = e.dept_id (+)
GROUP  BY d.dept_name
ORDER  BY headcount DESC;`,
      after: `SELECT d.dept_name,
       STRING_AGG(e.emp_name, ', ' ORDER BY e.emp_name) AS staff,
       COALESCE(COUNT(e.emp_id), 0) AS headcount
FROM   departments d
LEFT JOIN employees e ON d.dept_id = e.dept_id
GROUP  BY d.dept_name
ORDER  BY headcount DESC;`,
      note:
        "The (+) outer-join marker has no PostgreSQL equivalent and must become an explicit LEFT JOIN. LISTAGG's WITHIN GROUP clause moves inside STRING_AGG as an ORDER BY argument."
    }
  },
  {
    slug: "mysql-to-postgresql",
    source: "MySQL",
    target: "PostgreSQL",
    blurb:
      "MySQL to PostgreSQL trips on quoting, auto-increment and MySQL's permissive type coercion. The SQL itself is close; the schema and the strictness are not.",
    mappings: [
      ["`backtick` quoting", '"double quote" quoting'],
      ["AUTO_INCREMENT", "GENERATED ALWAYS AS IDENTITY (or SERIAL)"],
      ["IFNULL(x, y)", "COALESCE(x, y)"],
      ["IF(cond, a, b)", "CASE WHEN cond THEN a ELSE b END"],
      ["NOW()", "NOW() (same)"],
      ["LIMIT 10, 20", "LIMIT 20 OFFSET 10"],
      ["CONCAT(a, b)", "a || b"],
      ["GROUP_CONCAT(x)", "STRING_AGG(x, ',')"],
      ["DATE_FORMAT(d, '%Y-%m')", "TO_CHAR(d, 'YYYY-MM')"],
      ["DATE_ADD(d, INTERVAL 1 DAY)", "d + INTERVAL '1 day'"],
      ["YEAR(d)", "EXTRACT(YEAR FROM d)"],
      ["SUBSTRING_INDEX(s, ',', 1)", "SPLIT_PART(s, ',', 1)"],
      ["RAND()", "RANDOM()"],
      ["REPLACE INTO", "INSERT ... ON CONFLICT ... DO UPDATE"],
      ["INSERT ... ON DUPLICATE KEY UPDATE", "INSERT ... ON CONFLICT ... DO UPDATE"],
      ["TINYINT(1)", "BOOLEAN"],
      ["DATETIME", "TIMESTAMP"],
      ["MEDIUMTEXT / LONGTEXT", "TEXT"],
      ["UNSIGNED INT", "INTEGER with a CHECK (x >= 0)"],
      ["ENGINE=InnoDB", "(drop it, no equivalent)"]
    ],
    gotchas: [
      "PostgreSQL is strict about GROUP BY: every selected column must be grouped or aggregated. MySQL lets this slide by default and will happily return arbitrary rows.",
      "MySQL string comparison is case-insensitive by default; PostgreSQL is case-sensitive. WHERE name = 'bob' may stop matching 'Bob'.",
      "MySQL silently truncates and coerces bad values. PostgreSQL raises an error. Data that loaded fine in MySQL may be rejected.",
      "There is no UNSIGNED in PostgreSQL. Column ranges must be re-checked.",
      "NULLs sort in the opposite place. MySQL puts NULLs first in an ascending ORDER BY; PostgreSQL puts them last. Any paged or top-N query changes which rows appear.",
      "MySQL coerces types in comparisons, so WHERE code = 5 matches the string '5'. PostgreSQL raises an error rather than guessing, which turns a silent behaviour into a hard failure.",
      "MySQL's TIMESTAMP converts to and from the session time zone while DATETIME does not. Mapping DATETIME straight onto TIMESTAMP, or TIMESTAMP onto TIMESTAMP, loses that distinction — decide per column whether you want TIMESTAMPTZ."
    ],
    example: {
      title: "Grouped report with date formatting",
      before: `SELECT DATE_FORMAT(o.created_at, '%Y-%m') AS month,
       GROUP_CONCAT(o.status) AS statuses,
       IFNULL(SUM(o.total), 0) AS revenue
FROM \`orders\` o
WHERE o.created_at >= DATE_ADD(NOW(), INTERVAL -6 MONTH)
GROUP BY month
ORDER BY month
LIMIT 0, 12;`,
      after: `SELECT TO_CHAR(o.created_at, 'YYYY-MM') AS month,
       STRING_AGG(o.status, ',') AS statuses,
       COALESCE(SUM(o.total), 0) AS revenue
FROM "orders" o
WHERE o.created_at >= NOW() + INTERVAL '-6 months'
GROUP BY month
ORDER BY month
LIMIT 12 OFFSET 0;`,
      note:
        "Note the LIMIT argument order flips: MySQL's LIMIT offset, count becomes LIMIT count OFFSET offset. Getting this backwards returns the wrong page without any error."
    }
  },
  {
    slug: "postgresql-to-mysql",
    source: "PostgreSQL",
    target: "MySQL",
    blurb:
      "PostgreSQL to MySQL, usually to fit an existing hosting stack. This direction loses features rather than gaining them, so the conversion is mostly about finding what MySQL cannot express.",
    mappings: [
      ['"double quote" quoting', "`backtick` quoting"],
      ["SERIAL", "AUTO_INCREMENT"],
      ["a || b", "CONCAT(a, b)"],
      ["STRING_AGG(x, ',')", "GROUP_CONCAT(x)"],
      ["SPLIT_PART(s, ',', 1)", "SUBSTRING_INDEX(s, ',', 1)"],
      ["TO_CHAR(d, 'YYYY-MM')", "DATE_FORMAT(d, '%Y-%m')"],
      ["EXTRACT(YEAR FROM d)", "YEAR(d)"],
      ["RANDOM()", "RAND()"],
      ["BOOLEAN", "TINYINT(1)"],
      ["TIMESTAMP", "DATETIME"],
      ["NUMERIC(p, s)", "DECIMAL(p, s)"],
      ["TEXT", "TEXT / MEDIUMTEXT / LONGTEXT (pick a size)"],
      ["ON CONFLICT DO UPDATE", "ON DUPLICATE KEY UPDATE"],
      ["ILIKE", "LIKE (MySQL is case-insensitive already)"],
      ["JSONB", "JSON"],
      ["d + INTERVAL '1 day'", "DATE_ADD(d, INTERVAL 1 DAY)"],
      ["generate_series()", "(no equivalent; use a numbers table)"],
      ["RETURNING", "(no equivalent; SELECT after INSERT)"],
      ["DISTINCT ON (col)", "GROUP BY with a window function (MySQL 8+)"],
      ["text[] array column", "JSON column or a join table"]
    ],
    gotchas: [
      "MySQL has no RETURNING clause. Any INSERT that relied on getting the new row back needs a follow-up SELECT and possibly a transaction.",
      "PostgreSQL arrays and JSONB operators have no MySQL equivalent. Array columns usually become a JSON column or a join table.",
      "MySQL's default collation is case-insensitive, so WHERE name = 'bob' will start matching 'Bob' after migration. This changes query results, not just syntax.",
      "MySQL silently truncates oversized values in non-strict mode where PostgreSQL raised an error. Data loss can happen without warning.",
      "NULLs sort in the opposite place. PostgreSQL puts NULLs last in an ascending ORDER BY; MySQL puts them first. Top-N and paged queries return a different first page.",
      "PostgreSQL refuses to compare mismatched types; MySQL coerces them instead. Bugs that PostgreSQL caught at query time become silently wrong results in MySQL.",
      "TIMESTAMPTZ has no MySQL equivalent. Converting it to DATETIME discards the time-zone handling entirely, so values are stored as whatever wall-clock text they happened to render as."
    ],
    example: {
      title: "Upsert with RETURNING",
      before: `INSERT INTO inventory (sku, qty)
VALUES ('A-100', 5)
ON CONFLICT (sku)
DO UPDATE SET qty = inventory.qty + EXCLUDED.qty
RETURNING sku, qty;`,
      after: `INSERT INTO inventory (sku, qty)
VALUES ('A-100', 5)
ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty);
SELECT sku, qty FROM inventory WHERE sku = 'A-100';`,
      note:
        "RETURNING has no MySQL equivalent, so one atomic statement becomes two. If another session can write between them, wrap both in a transaction or you may read back someone else's value."
    }
  },
  {
    slug: "oracle-to-snowflake",
    source: "Oracle SQL",
    target: "Snowflake SQL",
    blurb:
      "Oracle to Snowflake, typically as part of a data-warehouse move. Snowflake is ANSI-friendly, so most of the work is removing Oracle-isms rather than learning new syntax.",
    mappings: [
      ["NVL(x, y)", "NVL(x, y) or COALESCE(x, y)"],
      ["NVL2(x, a, b)", "NVL2(x, a, b) (same)"],
      ["DECODE(a, b, c, d)", "DECODE(a, b, c, d) (same)"],
      ["SYSDATE", "CURRENT_TIMESTAMP()"],
      ["ROWNUM <= 10", "LIMIT 10"],
      ["LISTAGG(x, ',') WITHIN GROUP (ORDER BY y)", "LISTAGG(x, ',') WITHIN GROUP (ORDER BY y) (same)"],
      ["a.id = b.id (+)", "LEFT JOIN b ON a.id = b.id"],
      ["ADD_MONTHS(d, 3)", "ADD_MONTHS(d, 3) (same)"],
      ["MERGE INTO t USING ...", "MERGE INTO t USING ... (same)"],
      ["SYS_GUID()", "UUID_STRING()"],
      ["INSTR(s, 'x')", "POSITION('x', s)"],
      ["seq.NEXTVAL", "seq.NEXTVAL (same)"],
      ["FROM DUAL", "(omit; Snowflake allows bare SELECT)"],
      ["VARCHAR2(n)", "VARCHAR(n)"],
      ["NUMBER(p, s)", "NUMBER(p, s) (same)"],
      ["CLOB", "VARCHAR"],
      ["CONNECT BY", "recursive CTE (WITH RECURSIVE)"],
      ["MINUS", "MINUS or EXCEPT"],
      ["TO_DATE(s, fmt)", "TO_DATE(s, fmt) (same)"],
      ["PL/SQL block", "Snowflake Scripting or a JS UDF"],
      ["TRUNC(d)", "DATE_TRUNC('DAY', d)"]
    ],
    gotchas: [
      "Snowflake has no CONNECT BY. Hierarchical queries must be rewritten as recursive CTEs, which is a real rewrite and not a syntax swap.",
      "Oracle's empty-string-is-NULL behaviour does not carry over. Snowflake keeps '' distinct from NULL.",
      "PL/SQL packages have no direct equivalent. Procedural logic needs Snowflake Scripting or moving out of the database entirely.",
      "Snowflake identifiers fold to UPPERCASE unquoted; Oracle also uppercases, so this usually matches, but quoted names must be checked.",
      "Snowflake has three timestamp types. TIMESTAMP_NTZ ignores time zones, TIMESTAMP_LTZ converts to the session zone, TIMESTAMP_TZ stores an offset. Plain TIMESTAMP is an alias whose meaning depends on an account parameter — set it deliberately rather than inheriting it.",
      "Oracle silently casts strings to numbers and dates in comparisons. Snowflake is stricter and will error, so implicit conversions hidden in WHERE clauses surface only when that branch runs.",
      "Snowflake enforces no constraints except NOT NULL. Primary and foreign keys are accepted and recorded as metadata but never checked, so data that Oracle rejected will load without complaint."
    ],
    example: {
      title: "Top-N with an outer join",
      before: `SELECT c.cust_name,
       NVL(SUM(o.amount), 0) AS spend,
       ADD_MONTHS(MAX(o.order_date), 12) AS renew_by
FROM   customers c, orders o
WHERE  c.cust_id = o.cust_id (+)
GROUP  BY c.cust_name
HAVING SUM(o.amount) > 1000
ORDER  BY spend DESC;`,
      after: `SELECT c.cust_name,
       NVL(SUM(o.amount), 0) AS spend,
       ADD_MONTHS(MAX(o.order_date), 12) AS renew_by
FROM   customers c
LEFT JOIN orders o ON c.cust_id = o.cust_id
GROUP  BY c.cust_name
HAVING SUM(o.amount) > 1000
ORDER  BY spend DESC;`,
      note:
        "Snowflake keeps NVL and ADD_MONTHS, so the only required change here is the outer-join syntax. Most Oracle analytics queries convert this cleanly — the work is in PL/SQL and hierarchical queries, not SELECTs."
    }
  },
  {
    slug: "mysql-to-bigquery",
    source: "MySQL",
    target: "Google BigQuery",
    blurb:
      "MySQL to BigQuery. BigQuery is a columnar analytics engine, not a transactional database — some MySQL patterns have no equivalent by design.",
    mappings: [
      ["`backtick` around columns", "`backtick` around table paths"],
      ["IFNULL(x, y)", "IFNULL(x, y) (same)"],
      ["IF(cond, a, b)", "IF(cond, a, b) (same)"],
      ["LIMIT 10, 20", "LIMIT 20 OFFSET 10"],
      ["NOW()", "CURRENT_TIMESTAMP()"],
      ["GROUP_CONCAT(x)", "STRING_AGG(x, ',')"],
      ["DATE_FORMAT(d, '%Y-%m')", "FORMAT_DATE('%Y-%m', d)"],
      ["DATE_ADD(d, INTERVAL 1 DAY)", "DATE_ADD(d, INTERVAL 1 DAY) (same)"],
      ["YEAR(d)", "EXTRACT(YEAR FROM d)"],
      ["DATEDIFF(a, b)", "DATE_DIFF(a, b, DAY)"],
      ["SUBSTRING_INDEX(s, ',', 1)", "SPLIT(s, ',')[SAFE_OFFSET(0)]"],
      ["DATETIME", "DATETIME or TIMESTAMP"],
      ["TINYINT(1)", "BOOL"],
      ["CONCAT(a, b)", "CONCAT(a, b) (same)"],
      ["RAND()", "RAND() (same)"],
      ["AUTO_INCREMENT", "(no equivalent; generate keys yourself)"],
      ["UUID()", "GENERATE_UUID()"],
      ["INSERT ... ON DUPLICATE KEY", "MERGE statement"],
      ["CREATE INDEX", "(no equivalent; use partitioning and clustering)"],
      ["FOREIGN KEY", "(not enforced; handle it in the pipeline)"]
    ],
    gotchas: [
      "BigQuery has no indexes, no primary keys and no foreign keys. Schema logic that relies on constraints must move into your pipeline.",
      "There is no AUTO_INCREMENT. Surrogate keys must be generated before load, commonly with GENERATE_UUID().",
      "Row-by-row UPDATE and DELETE are expensive and quota-limited. BigQuery expects batch rewrites, not OLTP mutation patterns.",
      "Queries are billed by bytes scanned. A SELECT * that was free in MySQL can cost real money at scale.",
      "Division by zero raises an error in BigQuery rather than returning NULL as MySQL does. Ratio and percentage columns need SAFE_DIVIDE.",
      "BigQuery will not compare a STRING to an INT64 at all, where MySQL coerced them. Joins between keys that were loaded as different types simply fail until you cast one side.",
      "DATETIME carries no time zone and TIMESTAMP is always UTC. MySQL's session-dependent TIMESTAMP behaviour has no equivalent, so pick one and convert on the way in."
    ],
    example: {
      title: "Monthly rollup with a safe ratio",
      before: `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
       COUNT(*) AS orders,
       SUM(total) / COUNT(*) AS avg_order,
       GROUP_CONCAT(DISTINCT channel) AS channels
FROM \`sales\`
GROUP BY month
ORDER BY month;`,
      after: `SELECT FORMAT_DATE('%Y-%m', created_at) AS month,
       COUNT(*) AS orders,
       SAFE_DIVIDE(SUM(total), COUNT(*)) AS avg_order,
       STRING_AGG(DISTINCT channel, ',') AS channels
FROM \`project.dataset.sales\`
GROUP BY month
ORDER BY month;`,
      note:
        "Two things bite here: the table name becomes a fully-qualified project.dataset.table path, and plain division must become SAFE_DIVIDE or the whole query errors on any month with zero rows."
    }
  },
  {
    slug: "postgresql-to-snowflake",
    source: "PostgreSQL",
    target: "Snowflake SQL",
    blurb:
      "PostgreSQL to Snowflake, usually when analytics outgrows the transactional database. Both are ANSI-leaning, so most standard SQL moves across unchanged.",
    mappings: [
      ["SERIAL", "AUTOINCREMENT or IDENTITY"],
      ["NOW()", "CURRENT_TIMESTAMP()"],
      ["TEXT", "VARCHAR"],
      ["BOOLEAN", "BOOLEAN (same)"],
      ["STRING_AGG(x, ',')", "LISTAGG(x, ',')"],
      ["SPLIT_PART(s, ',', 1)", "SPLIT_PART(s, ',', 1) (same)"],
      ["d + INTERVAL '1 day'", "DATEADD('day', 1, d)"],
      ["AGE(a, b)", "DATEDIFF('day', b, a)"],
      ["TO_CHAR(d, 'YYYY-MM')", "TO_CHAR(d, 'YYYY-MM') (same)"],
      ["gen_random_uuid()", "UUID_STRING()"],
      ["JSONB", "VARIANT"],
      ["col->>'key'", "col:key::string"],
      ["generate_series()", "GENERATOR() with ROW_NUMBER()"],
      ["ILIKE", "ILIKE (same)"],
      ["DISTINCT ON", "QUALIFY ROW_NUMBER() OVER (...) = 1"],
      ["array_agg(x)", "ARRAY_AGG(x)"],
      ["unnest(arr)", "LATERAL FLATTEN(input => arr)"],
      ["ON CONFLICT DO UPDATE", "MERGE INTO ... WHEN MATCHED"],
      ["RETURNING", "(no equivalent; SELECT afterwards)"],
      ["::type cast", "::type cast (same)"]
    ],
    gotchas: [
      "PostgreSQL preserves lowercase for unquoted identifiers; Snowflake folds them to UPPERCASE. Tools that quote names will break on the case difference.",
      "DISTINCT ON is PostgreSQL-only. The Snowflake equivalent uses QUALIFY, which changes how the query is structured.",
      "JSONB operators (->, ->>, @>) have no direct Snowflake syntax; VARIANT uses dot and bracket access instead.",
      "Snowflake has no true foreign-key enforcement. Constraints are metadata only.",
      "Snowflake's plain TIMESTAMP is an alias controlled by an account parameter and usually resolves to TIMESTAMP_NTZ, which drops time zones. PostgreSQL TIMESTAMPTZ should normally become TIMESTAMP_LTZ or TIMESTAMP_TZ, chosen explicitly.",
      "NULL ordering is the same by default, but Snowflake applies NULLS LAST only for ascending sorts. Any query already using an explicit NULLS FIRST or NULLS LAST should be carried over rather than dropped.",
      "There is no RETURNING. Write-then-read patterns need a second statement, and Snowflake's per-statement commit means another job can change the row in between."
    ],
    example: {
      title: "Latest row per group",
      before: `SELECT DISTINCT ON (user_id)
       user_id,
       event_type,
       payload->>'source' AS source
FROM events
ORDER BY user_id, created_at DESC;`,
      after: `SELECT user_id,
       event_type,
       payload:source::string AS source
FROM events
QUALIFY ROW_NUMBER() OVER (
          PARTITION BY user_id ORDER BY created_at DESC) = 1;`,
      note:
        "DISTINCT ON relies on the ORDER BY to pick the winning row. Rewriting it with QUALIFY makes that choice explicit — if you drop the ORDER BY inside OVER, you get an arbitrary row per user instead of the newest."
    }
  },
  {
    slug: "excel-vba-to-python",
    source: "Excel VBA",
    target: "Python",
    blurb:
      "VBA to Python, usually to get a spreadsheet macro into a real pipeline. The logic ports easily; what changes is that Python has no implicit Excel context.",
    mappings: [
      ["Dim x As Integer", "x = 0 (no declaration needed)"],
      ['Range("A1").Value', "df.iloc[0, 0] or ws['A1'].value"],
      ["Cells(r, c)", "df.iat[r-1, c-1]"],
      ["For i = 1 To 10", "for i in range(1, 11):"],
      ["For Each c In rng", "for c in rng:"],
      ["Do While cond ... Loop", "while cond:"],
      ["If ... Then ... End If", "if ...: (indentation block)"],
      ['MsgBox "text"', 'print("text")'],
      ["' comment", "# comment"],
      ["& for concat", "+ or f-string"],
      ['Worksheets("Sheet1")', "pd.read_excel(path, sheet_name='Sheet1')"],
      ["On Error Resume Next", "try / except (must name the error)"],
      ["Sub / End Sub", "def name():"],
      ["Function / End Function", "def name(): with a return"],
      ["UBound(arr)", "len(arr) - 1"],
      ["Application.WorksheetFunction.Sum", "df[col].sum()"],
      ["Application.ScreenUpdating = False", "(not needed; no UI to repaint)"],
      ["Rows.Count / End(xlUp)", "len(df) or df.last_valid_index()"],
      ["Workbooks.Open(path)", "pd.read_excel(path) / openpyxl.load_workbook(path)"],
      ["ActiveWorkbook.Save", "df.to_excel(path) / wb.save(path)"]
    ],
    gotchas: [
      "VBA indexes from 1, Python from 0. Every loop bound and array index needs adjusting — this is the single most common source of off-by-one bugs in VBA ports.",
      "On Error Resume Next silently swallows every error. A direct translation to a bare except: hides real bugs; catch specific exceptions instead.",
      "VBA is single-threaded inside Excel and can read the live sheet. Python reads a file snapshot, so anything depending on live cell state must be restructured.",
      "VBA's Integer is 16-bit and overflows above 32,767. Python integers are unbounded, so overflow bugs may disappear — or reveal logic that relied on wrapping.",
      "Excel stores dates as serial numbers from 1900 and keeps a deliberate 1900 leap-year bug. Reading raw cell values instead of parsed dates can shift results by a day.",
      "Excel silently coerces text that looks numeric, so \"00123\" may already be the number 123 by the time VBA sees it. pandas keeps leading zeros only if you force the column to a string on read.",
      "Excel displays 15 significant digits but stores full IEEE floats. Totals that appeared to match in the sheet can differ in the last decimal place once Python prints them unrounded."
    ],
    example: {
      title: "Summing a column with a guard",
      before: `Sub TotalSales()
    Dim i As Integer
    Dim total As Double
    total = 0
    For i = 2 To 100
        If Cells(i, 3).Value > 0 Then
            total = total + Cells(i, 3).Value
        End If
    Next i
    MsgBox "Total: " & total
End Sub`,
      after: `import pandas as pd
def total_sales(path):
    df = pd.read_excel(path)
    col = df.iloc[0:99, 2]
    total = col[col > 0].sum()
    print(f"Total: {total}")`,
      note:
        "The loop disappears entirely — that is normal and desirable. Watch the bounds: VBA rows 2 to 100 include the header offset, so the pandas slice is 0:99 on a frame that has already consumed row 1 as its header."
    }
  },
  {
    slug: "python-to-javascript",
    source: "Python",
    target: "JavaScript / Node.js",
    blurb:
      "Python to JavaScript. The syntax maps closely, but async behaviour, integer maths and truthiness differ in ways that cause quiet bugs rather than loud errors.",
    mappings: [
      ["def f(x):", "function f(x) {"],
      ["print(x)", "console.log(x)"],
      ["len(x)", "x.length"],
      ["dict / {}", "object / Map"],
      ["list comprehension", ".map() / .filter()"],
      ["None", "null (or undefined)"],
      ['f"{a} b"', "`${a} b`"],
      ["for x in items:", "for (const x of items) {"],
      ["enumerate(items)", "items.entries()"],
      ["zip(a, b)", "a.map((x, i) => [x, b[i]])"],
      ["try / except E", "try / catch (e)"],
      ["raise ValueError(m)", "throw new Error(m)"],
      ["a // b (floor div)", "Math.floor(a / b)"],
      ["json.dumps(x)", "JSON.stringify(x)"],
      ["json.loads(s)", "JSON.parse(s)"],
      ["with open(p) as f:", "await fs.readFile(p)"],
      ["sorted(x, key=f)", "[...x].sort((a, b) => f(a) - f(b))"],
      ["x is None", "x === null || x === undefined"],
      ["**kwargs", "an options object"],
      ["class C:  __init__", "class C {  constructor()"]
    ],
    gotchas: [
      "Python integers are arbitrary precision; JavaScript numbers lose precision above 2^53. Large IDs and money values need BigInt or strings.",
      "Python's / always returns a float, JavaScript's / returns a float too, but // must become Math.floor — an easy silent difference.",
      "Empty list [] is falsy in Python but truthy in JavaScript. if (arr) does not mean what it meant.",
      "File and network I/O is synchronous in most Python code and asynchronous in Node. A direct port usually needs async/await threaded through every caller.",
      "Array.prototype.sort() compares elements as strings by default, so [10, 9, 1] sorts to [1, 10, 9]. Python's sort() is numeric. Every bare .sort() on numbers needs a comparator.",
      "Python's % returns a result with the divisor's sign, so -1 % 5 is 4. JavaScript returns -1. Any wrap-around or cyclic index maths changes behaviour.",
      "Python dicts preserve insertion order and compare by value; JavaScript objects coerce all keys to strings and compare by reference. Using a number and its string form as separate keys silently collides."
    ],
    example: {
      title: "Filtering and sorting records",
      before: `def top_scores(rows, limit=3):
    active = [r for r in rows if r["active"]]
    ranked = sorted(active, key=lambda r: r["score"], reverse=True)
    return ranked[:limit]`,
      after: `function topScores(rows, limit = 3) {
  const active = rows.filter((r) => r.active);
  const ranked = [...active].sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}`,
      note:
        "The comparator is not optional. Without (a, b) => b.score - a.score, JavaScript sorts the numbers as text and a score of 9 ranks above 10."
    }
  },
  {
    slug: "javascript-to-typescript",
    source: "JavaScript / Node.js",
    target: "TypeScript",
    blurb:
      "JavaScript to TypeScript. Valid JavaScript is already valid TypeScript — the work is adding types that are accurate rather than types that merely compile.",
    mappings: [
      ["function f(a, b)", "function f(a: string, b: number): void"],
      ["const x = {}", "const x: Record<string, unknown> = {}"],
      ["module.exports", "export default / export"],
      ["require()", "import"],
      ["array", "T[] or Array<T>"],
      ["callback(err, data)", "typed Promise<T>"],
      ["JSDoc @param", "inline type annotation"],
      ["any implicit", "explicit type or unknown"],
      ["class field", "field with visibility modifier"],
      ["destructuring", "destructuring with a typed shape"],
      ["null checks", "strictNullChecks with T | null"],
      [".js file", ".ts file plus tsconfig.json"],
      ["object literal shape", "interface or type alias"],
      ["a set of string constants", "union type or enum"],
      ["catch (e) { e.message }", "catch (e) { (e as Error).message }"],
      ["process.env.KEY", "process.env.KEY as string | undefined"],
      ["JSON.parse(s)", "JSON.parse(s) as T (still unchecked)"],
      ["arr.find(...)", "arr.find(...) returns T | undefined"],
      ["default export function", "export default function with a return type"],
      ["duck-typed argument", "generic <T> with a constraint"]
    ],
    gotchas: [
      "Typing everything as any compiles cleanly and buys nothing. If the converter emits any, that is a place to go back and specify the real shape.",
      "strictNullChecks is where most real bugs surface. Turning it off to get a green build defeats the purpose of migrating.",
      "Runtime data from APIs is not validated by TypeScript. Types are erased at compile time; external input still needs runtime checks.",
      "Default exports and CommonJS interop cause import errors that look like type errors. Check esModuleInterop before debugging types.",
      "A type assertion with as silences the compiler without changing anything at runtime. Casting an API response to your interface only moves the crash later.",
      "Array index access is assumed to succeed. arr[10] is typed T rather than T | undefined unless noUncheckedIndexedAccess is on, so an out-of-range read looks safe and is not.",
      "Types disappear when compiled, so nothing enforces them across a service boundary. Two services sharing an interface can drift apart with a green build on both sides."
    ],
    example: {
      title: "Typing a fetch helper honestly",
      before: `export async function getUser(id) {
  const res = await fetch("/api/users/" + id);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}`,
      after: `export interface User {
  id: string;
  email: string;
  displayName?: string;
}
export async function getUser(id: string): Promise<User> {
  const res = await fetch("/api/users/" + id);
  if (!res.ok) throw new Error("Request failed");
  return (await res.json()) as User;
}`,
      note:
        "That final as User is a promise you are making to the compiler, not a check. If the API drops displayName or renames a field, this still compiles and still breaks at runtime — validate the response if it comes from outside your codebase."
    }
  },
  {
    slug: "java-to-python",
    source: "Java",
    target: "Python",
    blurb:
      "Java to Python. The result is far shorter, but Java's static types and checked exceptions carry information that vanishes unless you deliberately keep it.",
    mappings: [
      ["public class Foo", "class Foo:"],
      ["public static void main", "if __name__ == '__main__':"],
      ["System.out.println(x)", "print(x)"],
      ["List<String>", "list[str]"],
      ["Map<K, V>", "dict[K, V]"],
      ["Optional<T>", "T | None"],
      ["for (int i = 0; i < n; i++)", "for i in range(n):"],
      ["for (T x : items)", "for x in items:"],
      ["try / catch (E e)", "try / except E:"],
      ["finally", "finally:"],
      ["throw new E(m)", "raise E(m)"],
      ["null", "None"],
      ["interface", "typing.Protocol or ABC"],
      ["abstract class", "ABC with @abstractmethod"],
      ["final", "typing.Final"],
      ["static method", "@staticmethod"],
      ["String.format()", "f-string"],
      ["StringBuilder", "list of parts + ''.join()"],
      ["getter / setter", "@property"],
      ["stream().filter().map()", "comprehension or filter/map"]
    ],
    gotchas: [
      "Java int overflows at 2^31; Python integers do not. Code relying on overflow wrapping will behave differently.",
      "Java checked exceptions force handling at compile time. Python has no equivalent, so error paths that were guaranteed become easy to forget.",
      "Java integer division truncates: 5/2 = 2. Python's / returns 2.5 — you almost always want // in the port.",
      "Java threads share memory freely. Python's GIL means threaded CPU-bound code will not speed up; it usually needs multiprocessing instead.",
      "Integer division rounds differently for negatives. Java's -7/2 is -3, Python's -7//2 is -4, because Java truncates toward zero and Python floors.",
      "Java's % follows the dividend's sign, so -7 % 3 is -1; Python returns 2. Hashing, bucketing and cyclic index code changes behaviour without erroring.",
      "A Python default argument is evaluated once at definition time. Translating a Java overload into def f(items=[]) gives every call the same shared list."
    ],
    example: {
      title: "Class with a guarded average",
      before: `public class Stats {
    private final List<Integer> values;
    public Stats(List<Integer> values) {
        this.values = values;
    }
    public int average() {
        if (values.isEmpty()) return 0;
        int sum = 0;
        for (int v : values) sum += v;
        return sum / values.size();
    }
}`,
      after: `class Stats:
    def __init__(self, values: list[int]):
        self.values = values
    def average(self) -> int:
        if not self.values:
            return 0
        return sum(self.values) // len(self.values)`,
      note:
        "sum / len would return a float and change the method's contract. The // keeps Java's integer division — but note it floors rather than truncates, so a set of negative values will differ by one."
    }
  },
  {
    slug: "php-to-python",
    source: "PHP",
    target: "Python",
    blurb:
      "PHP to Python, usually as part of moving off a legacy web stack. Loose typing and array semantics are where behaviour quietly changes.",
    mappings: [
      ["$variable", "variable"],
      ["echo / print", "print()"],
      ["array()  / []", "list or dict"],
      ["foreach ($a as $v)", "for v in a:"],
      ["foreach ($a as $k => $v)", "for k, v in a.items():"],
      ["count($a)", "len(a)"],
      ["==  (loose)", "== (strict; no coercion)"],
      ["===", "== (Python is already strict)"],
      ["null", "None"],
      ["function f($a)", "def f(a):"],
      [". for concat", "+ or f-string"],
      ["isset($x)", "'x' in d  or  x is not None"],
      ["empty($x)", "not x"],
      ["array_map / array_filter", "map() / filter() or comprehension"],
      ["in_array($v, $a)", "v in a"],
      ["array_keys($a)", "list(a.keys())"],
      ["explode(',', $s)", "s.split(',')"],
      ["implode(',', $a)", "','.join(a)"],
      ["json_encode()", "json.dumps()"],
      ["try / catch (Exception $e)", "try / except Exception as e:"]
    ],
    gotchas: [
      "PHP arrays are ordered maps that act as both list and dict. Choosing list vs dict in Python is a real decision the converter has to guess at — check it.",
      "PHP's == coerces types ('1' == 1 is true). Python's == does not. Comparisons can flip result after conversion.",
      "isset() checks existence AND non-null together. Splitting that into the right Python check depends on intent.",
      "PHP runs per-request and discards state. Python web apps often keep process state between requests, so globals behave differently.",
      "Reading a missing array key warns and yields null in PHP, but raises KeyError in Python. Code that quietly tolerated absent keys becomes a hard failure.",
      "empty() is true for 0, '0', '' and []. Translating it to not x is close but not identical, and '0' is the case that usually bites.",
      "PHP renumbers keys in some array functions and preserves them in others, so a list can silently become a sparse map. Confirm whether the original was really a sequence before choosing a Python list."
    ],
    example: {
      title: "Grouping rows by key",
      before: `function groupByStatus($rows) {
    $out = array();
    foreach ($rows as $r) {
        $key = $r['status'];
        if (!isset($out[$key])) {
            $out[$key] = array();
        }
        $out[$key][] = $r['id'];
    }
    return $out;
}`,
      after: `from collections import defaultdict
def group_by_status(rows):
    out = defaultdict(list)
    for r in rows:
        out[r["status"]].append(r["id"])
    return dict(out)`,
      note:
        "PHP's isset() guard becomes unnecessary with defaultdict. Keep the dict() call on the way out — returning the defaultdict itself means a later lookup of a missing status silently creates an empty entry instead of raising."
    }
  },
  {
    slug: "csharp-to-java",
    source: "C#",
    target: "Java",
    blurb:
      "C# to Java. The two languages are close cousins, so most code ports mechanically — the friction is in properties, LINQ and nullable types.",
    mappings: [
      ["public string Name { get; set; }", "private String name + getter/setter"],
      ["var x = ...", "var x = ... (Java 10+)"],
      ["List<T>", "List<T> (java.util)"],
      ["Dictionary<K,V>", "Map<K,V> / HashMap"],
      ["IEnumerable<T>", "Iterable<T> or Stream<T>"],
      ["foreach (var x in c)", "for (T x : c)"],
      ["LINQ .Where().Select()", "Stream .filter().map()"],
      [".ToList()", ".collect(Collectors.toList())"],
      [".FirstOrDefault()", ".findFirst().orElse(null)"],
      ['string interpolation $"{x}"', "String.format() or text blocks"],
      ["null-conditional ?.", "explicit null check / Optional"],
      ["?? (null coalescing)", "Objects.requireNonNullElse(a, b)"],
      ["async / await Task", "CompletableFuture"],
      ["namespace", "package"],
      ["IDisposable / using", "AutoCloseable / try-with-resources"],
      ["int?  (nullable)", "Integer (boxed)"],
      ["readonly", "final"],
      ["struct", "class (no value-type equivalent)"],
      ["record", "record (Java 16+)"],
      ["throw new ArgumentException", "throw new IllegalArgumentException"]
    ],
    gotchas: [
      "C# properties become getter/setter pairs in Java. Any code doing reflection or serialisation on property names needs revisiting.",
      "C# structs are value types; Java has no equivalent, so a struct becomes a class with reference semantics. Copy behaviour changes.",
      "async/await and CompletableFuture have different execution models. A mechanical translation often changes threading behaviour.",
      "C# nullable value types (int?) become boxed Integer in Java, which introduces null where the original guaranteed a value.",
      "LINQ is lazy but re-runs on each enumeration; a Java Stream can be consumed only once. Code that iterated a query twice compiles and then throws IllegalStateException at runtime.",
      "String switch and equality differ: C#'s == on string compares by value, Java's == compares references. Every string comparison needs .equals() or it will work only for interned literals.",
      "C# checks arithmetic overflow only inside a checked block and Java never does, but the boxed Integer cache means == on two Integer values above 127 becomes false. Comparisons that passed in testing fail on larger numbers."
    ],
    example: {
      title: "LINQ query to a Java Stream",
      before: `var names = people
    .Where(p => p.Age >= 18)
    .OrderBy(p => p.LastName)
    .Select(p => $"{p.FirstName} {p.LastName}")
    .ToList();`,
      after: `var names = people.stream()
    .filter(p -> p.getAge() >= 18)
    .sorted(Comparator.comparing(Person::getLastName))
    .map(p -> String.format("%s %s", p.getFirstName(), p.getLastName()))
    .collect(Collectors.toList());`,
      note:
        "Property access becomes method calls, and the stream is single-use. If the original LINQ variable was enumerated more than once, the Java version must be collected first and the collection reused."
    }
  }
];
export function getPair(slug) {
  return PAIRS.find((p) => p.slug === slug) || null;
}
/**
 * Dialect-specific review notes for a given source/target combination.
 * Powers the richer "Worth checking yourself" panel.
 */
export function pairGotchas(sourceLang, targetLang) {
  const pair = PAIRS.find((p) => p.source === sourceLang && p.target === targetLang);
  return pair ? pair.gotchas : [];
}
