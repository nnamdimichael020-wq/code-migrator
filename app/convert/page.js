import Link from "next/link";
import { PAIRS } from "../../lib/pairs";
export const dynamic = "force-static";
export const metadata = {
  title: "Code & SQL Converters — Free, No Signup | CodeShift AI",
  description:
    "Free online converters for SQL dialects and programming languages. Syntax mapping tables, migration pitfalls, and instant AI conversion with a line-by-line diff.",
  alternates: { canonical: "/convert" }
};
export default function ConvertIndex() {
  const sql = PAIRS.filter((p) => p.source.includes("SQL") || p.source.includes("Postgre") ||
    p.source.includes("MySQL") || p.source.includes("BigQuery"));
  const code = PAIRS.filter((p) => !sql.includes(p));
  const Card = ({ pair }) => (
    <Link
      href={`/convert/${pair.slug}`}
      className="block bg-slate-900 border border-slate-800 hover:border-indigo-600 rounded-xl p-4 transition"
    >
      <div className="font-semibold text-white text-sm">
        {pair.source} → {pair.target}
      </div>
      <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{pair.blurb}</p>
    </Link>
  );
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-4">
        <Link href="/" className="font-bold text-lg tracking-tight hover:text-indigo-400 transition">
          CodeShift AI
        </Link>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
          Code &amp; SQL Converters
        </h1>
        <p className="mt-3 text-slate-400">
          Each guide has a syntax mapping table and the migration traps that change behaviour
          without throwing an error. Three conversions a day are free, with no account.
        </p>
        <h2 className="text-lg font-bold text-white mt-10 mb-3">SQL dialects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sql.map((p) => <Card key={p.slug} pair={p} />)}
        </div>
        <h2 className="text-lg font-bold text-white mt-10 mb-3">Programming languages</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {code.map((p) => <Card key={p.slug} pair={p} />)}
        </div>
        <Link
          href="/"
          className="inline-block mt-10 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg transition"
        >
          Open the converter
        </Link>
      </main>
    </div>
  );
}
