// Data for the static conversion pages, and the source of dialect-specific
// review notes.
//
// Each pair carries real syntax mappings and real gotchas. These pages exist
// to be genuinely useful on their own — a developer should be able to solve
// their problem from the table without ever running a conversion. That is
// also what makes them worth linking to.
export const PAIRS = [
  {
    slug: "oracle-to-postgresql",
    source: "Oracle SQL",
    target: "PostgreSQL",
    blurb:
      "Oracle to PostgreSQL is the most common enterprise migration, usually driven by licensing cost. Most queries port cleanly; the traps are row limiting, date handling and empty-string semantics.",
    mappings: [
      ["NVL(x, y)", "COALESCE(x, y)"],
      ["SYSDATE", "CURRENT_DATE or NOW()"],
      ["ROWNUM <= 10", "LIMIT 10"],
      ["DECODE(a, b, c, d)", "CASE WHEN a = b THEN c ELSE d END"],
      ["SUBSTR(s, 1, 3)", "SUBSTRING(s FROM 1 FOR 3)"],
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
      "SYSDATE returns a DATE with a time component in Oracle. CURRENT_DATE in PostgreSQL has no time. Use NOW() if you need the time."
    ]
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
      ["NOW()", "NOW() (same)"],
      ["LIMIT 10, 20", "LIMIT 20 OFFSET 10"],
      ["CONCAT(a, b)", "a || b"],
      ["TINYINT(1)", "BOOLEAN"],
      ["DATETIME", "TIMESTAMP"],
      ["GROUP_CONCAT(x)", "STRING_AGG(x, ',')"],
      ["INSERT ... ON DUPLICATE KEY UPDATE", "INSERT ... ON CONFLICT ... DO UPDATE"],
      ["UNSIGNED INT", "INTEGER with a CHECK (x >= 0)"],
      ["ENGINE=InnoDB", "(drop it, no equivalent)"]
    ],
    gotchas: [
      "PostgreSQL is strict about GROUP BY: every selected column must be grouped or aggregated. MySQL lets this slide by default and will happily return arbitrary rows.",
      "MySQL string comparison is case-insensitive by default; PostgreSQL is case-sensitive. WHERE name = 'bob' may stop matching 'Bob'.",
      "MySQL silently truncates and coerces bad values. PostgreSQL raises an error. Data that loaded fine in MySQL may be rejected.",
      "There is no UNSIGNED in PostgreSQL. Column ranges must be re-checked."
    ]
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
      ["BOOLEAN", "TINYINT(1)"],
      ["TIMESTAMP", "DATETIME"],
      ["ON CONFLICT DO UPDATE", "ON DUPLICATE KEY UPDATE"],
      ["ILIKE", "LIKE (MySQL is case-insensitive already)"],
      ["JSONB", "JSON"],
      ["d + INTERVAL '1 day'", "DATE_ADD(d, INTERVAL 1 DAY)"],
      ["generate_series()", "(no equivalent; use a numbers table)"],
      ["RETURNING", "(no equivalent; SELECT after INSERT)"]
    ],
    gotchas: [
      "MySQL has no RETURNING clause. Any INSERT that relied on getting the new row back needs a follow-up SELECT and possibly a transaction.",
      "PostgreSQL arrays and JSONB operators have no MySQL equivalent. Array columns usually become a JSON column or a join table.",
      "MySQL's default collation is case-insensitive, so WHERE name = 'bob' will start matching 'Bob' after migration. This changes query results, not just syntax.",
      "MySQL silently truncates oversized values in non-strict mode where PostgreSQL raised an error. Data loss can happen without warning."
    ]
  },
  {
    slug: "oracle-to-snowflake",
    source: "Oracle SQL",
    target: "Snowflake SQL",
    blurb:
      "Oracle to Snowflake, typically as part of a data-warehouse move. Snowflake is ANSI-friendly, so most of the work is removing Oracle-isms rather than learning new syntax.",
    mappings: [
      ["NVL(x, y)", "NVL(x, y) or COALESCE(x, y)"],
      ["SYSDATE", "CURRENT_TIMESTAMP()"],
      ["ROWNUM <= 10", "LIMIT 10"],
      ["FROM DUAL", "(omit; Snowflake allows bare SELECT)"],
      ["VARCHAR2(n)", "VARCHAR(n)"],
      ["NUMBER(p, s)", "NUMBER(p, s) (same)"],
      ["CONNECT BY", "recursive CTE (WITH RECURSIVE)"],
      ["MINUS", "MINUS or EXCEPT"],
      ["TO_DATE(s, fmt)", "TO_DATE(s, fmt) (same)"],
      ["PL/SQL block", "Snowflake Scripting or a JS UDF"],
      ["MERGE", "MERGE (same)"],
      ["TRUNC(d)", "DATE_TRUNC('DAY', d)"]
    ],
    gotchas: [
      "Snowflake has no CONNECT BY. Hierarchical queries must be rewritten as recursive CTEs, which is a real rewrite and not a syntax swap.",
      "Oracle's empty-string-is-NULL behaviour does not carry over. Snowflake keeps '' distinct from NULL.",
      "PL/SQL packages have no direct equivalent. Procedural logic needs Snowflake Scripting or moving out of the database entirely.",
      "Snowflake identifiers fold to UPPERCASE unquoted; Oracle also uppercases, so this usually matches, but quoted names must be checked."
    ]
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
      ["LIMIT 10, 20", "LIMIT 20 OFFSET 10"],
      ["NOW()", "CURRENT_TIMESTAMP()"],
      ["GROUP_CONCAT(x)", "STRING_AGG(x, ',')"],
      ["DATETIME", "DATETIME or TIMESTAMP"],
      ["AUTO_INCREMENT", "(no equivalent; generate keys yourself)"],
      ["INSERT ... ON DUPLICATE KEY", "MERGE statement"],
      ["TINYINT(1)", "BOOL"],
      ["CONCAT(a, b)", "CONCAT(a, b) (same)"],
      ["RAND()", "RAND() (same)"],
      ["SUBSTRING_INDEX", "SPLIT() with array indexing"]
    ],
    gotchas: [
      "BigQuery has no indexes, no primary keys and no foreign keys. Schema logic that relies on constraints must move into your pipeline.",
      "There is no AUTO_INCREMENT. Surrogate keys must be generated before load, commonly with GENERATE_UUID().",
      "Row-by-row UPDATE and DELETE are expensive and quota-limited. BigQuery expects batch rewrites, not OLTP mutation patterns.",
      "Queries are billed by bytes scanned. A SELECT * that was free in MySQL can cost real money at scale."
    ]
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
      ["d + INTERVAL '1 day'", "DATEADD('day', 1, d)"],
      ["JSONB", "VARIANT"],
      ["generate_series()", "GENERATOR() with ROW_NUMBER()"],
      ["ILIKE", "ILIKE (same)"],
      ["DISTINCT ON", "QUALIFY ROW_NUMBER() OVER (...) = 1"],
      ["array_agg(x)", "ARRAY_AGG(x)"],
      ["::type cast", "::type cast (same)"]
    ],
    gotchas: [
      "PostgreSQL preserves lowercase for unquoted identifiers; Snowflake folds them to UPPERCASE. Tools that quote names will break on the case difference.",
      "DISTINCT ON is PostgreSQL-only. The Snowflake equivalent uses QUALIFY, which changes how the query is structured.",
      "JSONB operators (->, ->>, @>) have no direct Snowflake syntax; VARIANT uses dot and bracket access instead.",
      "Snowflake has no true foreign-key enforcement. Constraints are metadata only."
    ]
  },
  {
    slug: "excel-vba-to-python",
    source: "Excel VBA",
    target: "Python",
    blurb:
      "VBA to Python, usually to get a spreadsheet macro into a real pipeline. The logic ports easily; what changes is that Python has no implicit Excel context.",
    mappings: [
      ["Dim x As Integer", "x = 0 (no declaration needed)"],
      ["Range(\"A1\").Value", "df.iloc[0, 0] or ws['A1'].value"],
      ["Cells(r, c)", "df.iat[r-1, c-1]"],
      ["For i = 1 To 10", "for i in range(1, 11):"],
      ["If ... Then ... End If", "if ...: (indentation block)"],
      ["MsgBox \"text\"", "print(\"text\")"],
      ["' comment", "# comment"],
      ["& for concat", "+ or f-string"],
      ["Worksheets(\"Sheet1\")", "pd.read_excel(path, sheet_name='Sheet1')"],
      ["On Error Resume Next", "try / except (must name the error)"],
      ["Sub / End Sub", "def name():"],
      ["UBound(arr)", "len(arr) - 1"]
    ],
    gotchas: [
      "VBA indexes from 1, Python from 0. Every loop bound and array index needs adjusting — this is the single most common source of off-by-one bugs in VBA ports.",
      "On Error Resume Next silently swallows every error. A direct translation to a bare except: hides real bugs; catch specific exceptions instead.",
      "VBA is single-threaded inside Excel and can read the live sheet. Python reads a file snapshot, so anything depending on live cell state must be restructured.",
      "VBA's Integer is 16-bit and overflows above 32,767. Python integers are unbounded, so overflow bugs may disappear — or reveal logic that relied on wrapping."
    ]
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
      ["f\"{a} b\"", "`${a} b`"],
      ["for x in items:", "for (const x of items) {"],
      ["try / except E", "try / catch (e)"],
      ["a // b (floor div)", "Math.floor(a / b)"],
      ["json.dumps(x)", "JSON.stringify(x)"],
      ["with open(p) as f:", "await fs.readFile(p)"]
    ],
    gotchas: [
      "Python integers are arbitrary precision; JavaScript numbers lose precision above 2^53. Large IDs and money values need BigInt or strings.",
      "Python's / always returns a float, JavaScript's / returns a float too, but // must become Math.floor — an easy silent difference.",
      "Empty list [] is falsy in Python but truthy in JavaScript. if (arr) does not mean what it meant.",
      "File and network I/O is synchronous in most Python code and asynchronous in Node. A direct port usually needs async/await threaded through every caller."
    ]
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
      [".js file", ".ts file plus tsconfig.json"]
    ],
    gotchas: [
      "Typing everything as any compiles cleanly and buys nothing. If the converter emits any, that is a place to go back and specify the real shape.",
      "strictNullChecks is where most real bugs surface. Turning it off to get a green build defeats the purpose of migrating.",
      "Runtime data from APIs is not validated by TypeScript. Types are erased at compile time; external input still needs runtime checks.",
      "Default exports and CommonJS interop cause import errors that look like type errors. Check esModuleInterop before debugging types."
    ]
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
      ["for (int i = 0; i < n; i++)", "for i in range(n):"],
      ["try / catch (E e)", "try / except E:"],
      ["null", "None"],
      ["interface", "typing.Protocol or ABC"],
      ["final", "typing.Final"],
      ["String.format()", "f-string"],
      ["getter / setter", "@property"]
    ],
    gotchas: [
      "Java int overflows at 2^31; Python integers do not. Code relying on overflow wrapping will behave differently.",
      "Java checked exceptions force handling at compile time. Python has no equivalent, so error paths that were guaranteed become easy to forget.",
      "Java integer division truncates: 5/2 = 2. Python's / returns 2.5 — you almost always want // in the port.",
      "Java threads share memory freely. Python's GIL means threaded CPU-bound code will not speed up; it usually needs multiprocessing instead."
    ]
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
      ["foreach ($a as $k => $v)", "for k, v in a.items():"],
      ["count($a)", "len(a)"],
      ["==  (loose)", "== (strict; no coercion)"],
      ["null", "None"],
      ["function f($a)", "def f(a):"],
      [". for concat", "+ or f-string"],
      ["isset($x)", "'x' in d  or  x is not None"],
      ["json_encode()", "json.dumps()"],
      ["try / catch (Exception $e)", "try / except Exception as e:"]
    ],
    gotchas: [
      "PHP arrays are ordered maps that act as both list and dict. Choosing list vs dict in Python is a real decision the converter has to guess at — check it.",
      "PHP's == coerces types ('1' == 1 is true). Python's == does not. Comparisons can flip result after conversion.",
      "isset() checks existence AND non-null together. Splitting that into the right Python check depends on intent.",
      "PHP runs per-request and discards state. Python web apps often keep process state between requests, so globals behave differently."
    ]
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
      ["foreach (var x in c)", "for (T x : c)"],
      ["LINQ .Where().Select()", "Stream .filter().map()"],
      ["string interpolation $\"{x}\"", "String.format() or text blocks"],
      ["null-conditional ?.", "explicit null check / Optional"],
      ["async / await Task", "CompletableFuture"],
      ["namespace", "package"],
      ["IDisposable / using", "AutoCloseable / try-with-resources"],
      ["int?  (nullable)", "Integer (boxed)"]
    ],
    gotchas: [
      "C# properties become getter/setter pairs in Java. Any code doing reflection or serialisation on property names needs revisiting.",
      "C# structs are value types; Java has no equivalent, so a struct becomes a class with reference semantics. Copy behaviour changes.",
      "async/await and CompletableFuture have different execution models. A mechanical translation often changes threading behaviour.",
      "C# nullable value types (int?) become boxed Integer in Java, which introduces null where the original guaranteed a value."
    ]
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
