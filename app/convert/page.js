import Link from "next/link";
import { MODIFIERS, PAIRS } from "../../lib/pairs";
import SiteHeader from "../components/SiteHeader";

export const dynamic = "force-static";

export const metadata = {
  title: "Code & SQL Converters — Free, No Signup | CodeShift AI",
  description:
    "Free online converters for SQL dialects and programming languages. Pre-filled examples, syntax mapping tables, migration pitfalls, and instant AI conversion.",
  alternates: { canonical: "/convert" }
};

function Card({ pair }) {
  return (
    <Link
      href={`/convert/${pair.slug}`}
      className="block bg-slate-900 border border-slate-800 hover:border-indigo-600 rounded-xl p-4 transition"
    >
      <div className="font-semibold text-white text-sm">
        {pair.title || `${pair.source} → ${pair.target}`}
      </div>
      <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{pair.blurb}</p>
    </Link>
  );
}

export default function ConvertIndex() {
  const sql = PAIRS.filter(
    (p) =>
      p.source.includes("SQL") ||
      p.source.includes("Postgre") ||
      p.source.includes("MySQL") ||
      p.source.includes("BigQuery")
  );
  const code = PAIRS.filter((p) => !sql.includes(p));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
          Code & SQL Converters
        </h1>
        <p className="mt-3 text-slate-400">
          Each page is a pre-filled sandbox for that pair — sample on the left, converted
          result on the right — plus the mapping table and the traps that change behaviour
          without throwing an error. Three conversions a day are free, with no account.
        </p>
        <h2 className="text-lg font-bold text-white mt-10 mb-3">SQL dialects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sql.map((p) => (
            <Card key={p.slug} pair={p} />
          ))}
        </div>
        <h2 className="text-lg font-bold text-white mt-10 mb-3">Programming languages</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {code.map((p) => (
            <Card key={p.slug} pair={p} />
          ))}
        </div>
        <h2 className="text-lg font-bold text-white mt-10 mb-3">Guides and silent traps</h2>
        <p className="text-sm text-slate-500 mb-3">
          Same converter, tighter intent — migration guides, silent-trap lists, and
          use-case cuts like VBA → Python as a microservice.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODIFIERS.map((p) => (
            <Card key={p.slug} pair={p} />
          ))}
        </div>
        <Link
          href="/#translator"
          className="inline-block mt-10 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg transition"
        >
          Open the converter
        </Link>
        <p className="mt-4 text-xs text-slate-600">
          <Link href="/reviews" className="text-indigo-400 hover:text-indigo-300">Leave a review</Link>
          <span className="mx-2 text-slate-700">·</span>
          <Link href="/feedback" className="text-indigo-400 hover:text-indigo-300">Send feedback</Link>
        </p>
      </main>
    </div>
  );
}
