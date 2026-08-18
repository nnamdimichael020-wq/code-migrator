// High-intent modifier pages. Thin on purpose: mapping table + 3 traps + the
// same pre-filled sandbox as the parent pair. Do not invent languages the
// converter cannot actually select.

export const MODIFIERS = [
  {
    slug: "oracle-to-postgresql-migration-guide",
    parent: "oracle-to-postgresql",
    source: "Oracle SQL",
    target: "PostgreSQL",
    title: "Oracle to PostgreSQL Migration Guide",
    blurb:
      "A short migration guide for the Oracle → PostgreSQL move: the syntax that ports, the three traps that do not, and a working converter pre-loaded with a real query.",
    mappings: [
      ["NVL(x, y)", "COALESCE(x, y)"],
      ["NVL2(x, a, b)", "CASE WHEN x IS NOT NULL THEN a ELSE b END"],
      ["ROWNUM <= n", "LIMIT n  (and watch ORDER BY)"],
      ["SYSDATE", "NOW() if you need the time"],
      ["a.id = b.id (+)", "LEFT JOIN b ON a.id = b.id"],
      ["LISTAGG(...) WITHIN GROUP", "STRING_AGG(..., ORDER BY)"],
      ["DUAL", "(omit FROM)"],
      ["MINUS", "EXCEPT"]
    ],
    gotchas: [
      "ROWNUM is applied BEFORE ORDER BY in Oracle; LIMIT is applied AFTER in PostgreSQL. Swapping the keyword can return a different set of rows.",
      "Oracle treats '' as NULL. PostgreSQL does not. IS NULL checks on text columns change meaning.",
      "Oracle's (+) outer join has no PostgreSQL equivalent and must become an explicit LEFT JOIN — leaving it in place is a syntax error, not a silent one, but a half-rewritten WHERE clause often is."
    ],
    example: {
      title: "Outer join plus LISTAGG",
      before: `SELECT d.dept_name,
       LISTAGG(e.emp_name, ', ')
         WITHIN GROUP (ORDER BY e.emp_name) AS staff
FROM   departments d, employees e
WHERE  d.dept_id = e.dept_id (+)
GROUP  BY d.dept_name;`,
      after: `SELECT d.dept_name,
       STRING_AGG(e.emp_name, ', ' ORDER BY e.emp_name) AS staff
FROM   departments d
LEFT JOIN employees e ON d.dept_id = e.dept_id
GROUP  BY d.dept_name;`,
      note: "The (+) marker has to become a real JOIN. LISTAGG's WITHIN GROUP clause moves inside STRING_AGG."
    }
  },
  {
    slug: "oracle-sql-silent-traps",
    parent: "oracle-to-postgresql",
    source: "Oracle SQL",
    target: "PostgreSQL",
    title: "Oracle SQL Silent Traps",
    blurb:
      "The Oracle behaviours that compile after a port and then return the wrong answer. No error, no warning — just different rows or different NULLs.",
    mappings: [
      ["'' (empty string)", "NULL in Oracle, '' in PostgreSQL"],
      ["ROWNUM + ORDER BY", "LIMIT after ORDER BY"],
      ["SYSDATE", "DATE with time vs CURRENT_DATE without"],
      ["'a' || NULL", "'a' in Oracle, NULL in PostgreSQL"],
      ["WHERE id = '42'", "implicit cast vs type error"],
      ["unquoted identifiers", "Oracle uppercases, PostgreSQL lowercases"]
    ],
    gotchas: [
      "ROWNUM filters before the sort; LIMIT filters after. A top-N query can silently pick a different N rows.",
      "Concatenating NULL: 'a' || NULL is 'a' in Oracle and NULL in PostgreSQL, so optional columns can wipe a built-up string.",
      "Empty string is NULL in Oracle only. Any IS NULL / IS NOT NULL test on a text column can flip."
    ],
    example: {
      title: "Top-N that looks the same and is not",
      before: `SELECT emp_name, salary
FROM   employees
WHERE  ROWNUM <= 5
ORDER  BY salary DESC;`,
      after: `SELECT emp_name, salary
FROM   employees
ORDER  BY salary DESC
LIMIT  5;`,
      note: "In Oracle this is five arbitrary rows, then sorted. In PostgreSQL it is the five highest salaries. The rewritten form is usually what people wanted — confirm before you ship it."
    }
  },
  {
    slug: "excel-vba-to-python-microservice",
    parent: "excel-vba-to-python",
    source: "Excel VBA",
    target: "Python",
    title: "Excel VBA to Python Microservice",
    blurb:
      "Take a spreadsheet macro out of Excel and into a small Python service. The logic ports; the implicit workbook context does not.",
    mappings: [
      ['Workbooks.Open(path)', "pd.read_excel(path)"],
      ['Range("A1").Value', "df.iloc[0, 0]"],
      ["Cells(r, c)", "df.iat[r-1, c-1]   # 0-based"],
      ["For i = 2 To last", "vectorised column op, not a Python for-loop"],
      ["On Error Resume Next", "try / except with a named error"],
      ["ActiveWorkbook.Save", "df.to_excel(path) / return the frame"]
    ],
    gotchas: [
      "VBA indexes from 1, Python from 0. Every Cells(r, c) is off-by-one until you subtract.",
      "There is no ActiveWorkbook. A service reads a file snapshot; anything that depended on the live sheet must be passed in.",
      "On Error Resume Next becomes a silent except: and will hide real bugs in a service. Catch the specific error or let it fail."
    ],
    example: {
      title: "A guarded column total, as a function",
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

def total_sales(path: str) -> float:
    df = pd.read_excel(path)
    col = df.iloc[0:99, 2]
    total = float(col[col > 0].sum())
    return total`,
      note: "The loop should disappear. Returning a number (not MsgBox) is what a microservice actually needs."
    }
  },
  {
    slug: "excel-vba-to-python-pandas",
    parent: "excel-vba-to-python",
    source: "Excel VBA",
    target: "Python",
    title: "Excel VBA to Pandas — Skip the Row Loop",
    blurb:
      "The usual AI trap is df.iterrows(). For any spreadsheet-sized table that is the wrong default. This page is the vectorised version.",
    mappings: [
      ["For i = 2 To lastRow", "boolean mask / np.select — not iterrows()"],
      ["If Cells(i, c) = x Then", "df[col] == x"],
      ["Cells(i, dest) = expr", "df[dest] = expr  (whole column)"],
      ["WorksheetFunction.Sum", "df[col].sum()"],
      ["WorksheetFunction.VLookup", "df.merge(...) or .map()"],
      ["Rows.Count / End(xlUp)", "len(df)"]
    ],
    gotchas: [
      "df.iterrows() plus list.append is a line-for-line VBA port and throws away NumPy speed. Prefer np.select / boolean masks.",
      "Excel dates are 1900 serials with a leap-year bug. Read them as parsed dates, not raw numbers.",
      "Text that looks numeric ('00123') is often already a number by the time VBA sees it. Force dtype=str on read if leading zeros matter."
    ],
    example: {
      title: "Status discounts without a row loop",
      before: `For i = 2 To lastRow
    If Cells(i, 3).Value = "VIP" Then
        Cells(i, 5).Value = Cells(i, 4).Value * 0.9
    Else
        Cells(i, 5).Value = Cells(i, 4).Value
    End If
Next i`,
      after: `import numpy as np

status = df.iloc[:, 2]
price = df.iloc[:, 3].astype(float)
df["discounted"] = np.where(status == "VIP", price * 0.9, price)`,
      note: "np.where (or np.select for more branches) is the pandas-shaped version of that If. An iterrows() translation of this is a bug, not a style choice."
    }
  },
  {
    slug: "mysql-to-postgresql-migration-guide",
    parent: "mysql-to-postgresql",
    source: "MySQL",
    target: "PostgreSQL",
    title: "MySQL to PostgreSQL Migration Guide",
    blurb:
      "The SQL is close. The schema and the strictness are not. Quoting, auto-increment and GROUP BY are where a MySQL dump stops being a drop-in.",
    mappings: [
      ["`backticks`", '"double quotes"'],
      ["AUTO_INCREMENT", "GENERATED ALWAYS AS IDENTITY"],
      ["IFNULL(x, y)", "COALESCE(x, y)"],
      ["LIMIT 10, 20", "LIMIT 20 OFFSET 10"],
      ["GROUP_CONCAT(x)", "STRING_AGG(x, ',')"],
      ["ON DUPLICATE KEY UPDATE", "ON CONFLICT ... DO UPDATE"],
      ["TINYINT(1)", "BOOLEAN"]
    ],
    gotchas: [
      "PostgreSQL requires every selected column to be grouped or aggregated. MySQL's default does not — those queries error after the move.",
      "LIMIT offset, count flips to LIMIT count OFFSET offset. Getting this backwards pages the wrong slice with no error.",
      "MySQL string comparison is case-insensitive by default; PostgreSQL is not. WHERE name = 'bob' may stop matching 'Bob'."
    ],
    example: {
      title: "A paged report",
      before: `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
       IFNULL(SUM(total), 0) AS revenue
FROM \`orders\`
GROUP BY month
ORDER BY month
LIMIT 0, 12;`,
      after: `SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
       COALESCE(SUM(total), 0) AS revenue
FROM "orders"
GROUP BY month
ORDER BY month
LIMIT 12 OFFSET 0;`,
      note: "Watch the LIMIT argument order. MySQL's (offset, count) is the reverse of PostgreSQL."
    }
  },
  {
    slug: "oracle-to-snowflake-migration-guide",
    parent: "oracle-to-snowflake",
    source: "Oracle SQL",
    target: "Snowflake SQL",
    title: "Oracle to Snowflake Migration Guide",
    blurb:
      "Most SELECT syntax survives. CONNECT BY, PL/SQL and empty-string-is-NULL do not. This is the warehouse-shaped cut of the Oracle → Snowflake move.",
    mappings: [
      ["NVL / DECODE", "same names, still valid"],
      ["ROWNUM <= n", "LIMIT n"],
      ["(+) outer join", "LEFT JOIN"],
      ["FROM DUAL", "(omit)"],
      ["CONNECT BY PRIOR", "WITH RECURSIVE"],
      ["SYS_GUID()", "UUID_STRING()"],
      ["PL/SQL block", "Snowflake Scripting or a UDF"]
    ],
    gotchas: [
      "Snowflake has no CONNECT BY. Hierarchical queries are a real rewrite, not a rename.",
      "Empty string is not NULL in Snowflake. Oracle IS NULL tests on text columns change meaning.",
      "Primary and foreign keys are metadata only in Snowflake. Data Oracle rejected will load without complaint."
    ],
    example: {
      title: "Outer join that Snowflake already understands",
      before: `SELECT c.cust_name,
       NVL(SUM(o.amount), 0) AS spend
FROM   customers c, orders o
WHERE  c.cust_id = o.cust_id (+)
GROUP  BY c.cust_name;`,
      after: `SELECT c.cust_name,
       NVL(SUM(o.amount), 0) AS spend
FROM   customers c
LEFT JOIN orders o ON c.cust_id = o.cust_id
GROUP  BY c.cust_name;`,
      note: "NVL stays. The only required change in a typical analytic SELECT is the join syntax."
    }
  },
  {
    slug: "mysql-to-bigquery-analytics",
    parent: "mysql-to-bigquery",
    source: "MySQL",
    target: "Google BigQuery",
    title: "MySQL to BigQuery for Analytics",
    blurb:
      "BigQuery is not a MySQL server in the cloud. No indexes, no AUTO_INCREMENT, billed by bytes scanned. The SQL looks familiar; the cost model does not.",
    mappings: [
      ["`table`", "`project.dataset.table`"],
      ["GROUP_CONCAT(x)", "STRING_AGG(x, ',')"],
      ["DATE_FORMAT(d, '%Y-%m')", "FORMAT_DATE('%Y-%m', d)"],
      ["SUM(x) / COUNT(*)", "SAFE_DIVIDE(SUM(x), COUNT(*))"],
      ["AUTO_INCREMENT", "GENERATE_UUID() at load time"],
      ["LIMIT 10, 20", "LIMIT 20 OFFSET 10"]
    ],
    gotchas: [
      "Division by zero errors in BigQuery; MySQL returned NULL. Use SAFE_DIVIDE on any ratio.",
      "SELECT * that was free in MySQL is billed by bytes scanned. Project only the columns you need.",
      "There is no AUTO_INCREMENT. Surrogate keys have to be generated before load."
    ],
    example: {
      title: "Monthly average that cannot blow up",
      before: `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
       SUM(total) / COUNT(*) AS avg_order
FROM \`sales\`
GROUP BY month;`,
      after: `SELECT FORMAT_DATE('%Y-%m', created_at) AS month,
       SAFE_DIVIDE(SUM(total), COUNT(*)) AS avg_order
FROM \`project.dataset.sales\`
GROUP BY month;`,
      note: "Two changes: fully-qualified table path, and SAFE_DIVIDE so an empty month does not fail the whole job."
    }
  },
  {
    slug: "python-to-javascript-async",
    parent: "python-to-javascript",
    source: "Python",
    target: "JavaScript / Node.js",
    title: "Python to JavaScript: Async and I/O",
    blurb:
      "The syntax maps. The I/O model does not. A direct port of open() / requests.get() into Node without async/await is the usual breakage.",
    mappings: [
      ["def f(x):", "async function f(x) {  /* if it I/Os */"],
      ["open(path).read()", "await fs.readFile(path, 'utf8')"],
      ["requests.get(url)", "await fetch(url)"],
      ["for x in items:", "for (const x of items) {"],
      ["None", "null"],
      ["list comprehension", ".map() / .filter()"]
    ],
    gotchas: [
      "Most Python I/O is sync; most Node I/O is async. A mechanical port needs async/await threaded through every caller.",
      "[] is falsy in Python and truthy in JavaScript. if (arr) does not mean what it meant.",
      "Array.prototype.sort() compares as strings. [10, 9, 1] becomes [1, 10, 9] unless you pass a comparator."
    ],
    example: {
      title: "A fetch that has to be async",
      before: `def fetch_user(user_id):
    import urllib.request, json
    with urllib.request.urlopen(f"/api/users/{user_id}") as res:
        return json.loads(res.read().decode())`,
      after: `async function fetchUser(userId) {
  const res = await fetch(\`/api/users/\${userId}\`);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}`,
      note: "The await is not optional. Callers of fetchUser must be async too, or you get a Promise where the Python code had a dict."
    }
  },
  {
    slug: "javascript-to-typescript-strict",
    parent: "javascript-to-typescript",
    source: "JavaScript / Node.js",
    target: "TypeScript",
    title: "JavaScript to TypeScript, Strict Mode",
    blurb:
      "Valid JavaScript is already valid TypeScript. The work is types that are true, not types that compile. any and as T are the two ways to fake it.",
    mappings: [
      ["function f(a, b)", "function f(a: string, b: number): void"],
      ["any (implicit)", "unknown, then narrow"],
      ["as T", "a runtime check, then T"],
      ["arr[i]", "T | undefined  (noUncheckedIndexedAccess)"],
      ["JSON.parse(s)", "JSON.parse(s) is still any"],
      ["catch (e) { e.message }", "e is unknown — narrow it"]
    ],
    gotchas: [
      "as User is a promise to the compiler, not a check. A renamed API field still compiles and still breaks at runtime.",
      "strictNullChecks is where the real bugs surface. Turning it off to get a green build defeats the migration.",
      "Types are erased. Two services sharing an interface can drift with a green build on both sides."
    ],
    example: {
      title: "A fetch helper typed honestly",
      before: `export async function getUser(id) {
  const res = await fetch("/api/users/" + id);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}`,
      after: `export interface User {
  id: string;
  email: string;
}
export async function getUser(id: string): Promise<User> {
  const res = await fetch("/api/users/" + id);
  if (!res.ok) throw new Error("Request failed");
  return (await res.json()) as User;
}`,
      note: "That final as User is still a claim. Validate the payload if it comes from outside your codebase."
    }
  },
  {
    slug: "php-to-python-legacy-web",
    parent: "php-to-python",
    source: "PHP",
    target: "Python",
    title: "PHP to Python for a Legacy Web Stack",
    blurb:
      "Arrays that are both lists and maps, == that coerces, and per-request process death. Those three are why a line-for-line PHP port misbehaves in Python.",
    mappings: [
      ["$var", "var"],
      ["foreach ($a as $k => $v)", "for k, v in a.items():"],
      ["==  (loose)", "==  (no coercion — use carefully)"],
      ["isset($x)", "key in d  /  x is not None"],
      ["empty($x)", "not x   (but '0' differs)"],
      ["explode / implode", "split / join"]
    ],
    gotchas: [
      "PHP == coerces ('1' == 1 is true). Python == does not. Comparisons flip after the port.",
      "empty('0') is true in PHP; not '0' is false in Python. That single case is the usual production bug.",
      "A missing array key warns and yields null in PHP, and raises KeyError in Python. Code that tolerated absent keys becomes a 500."
    ],
    example: {
      title: "Grouping rows without isset()",
      before: `function groupByStatus($rows) {
    $out = array();
    foreach ($rows as $r) {
        $key = $r['status'];
        if (!isset($out[$key])) $out[$key] = array();
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
      note: "Return dict(out), not the defaultdict. Otherwise a later lookup of a missing status silently creates an empty list."
    }
  }
];
