import Link from "next/link";
import { notFound } from "next/navigation";
import { PAIRS, getPair, LAST_UPDATED } from "../../../lib/pairs";
import { diffLines, countChanges } from "../../../lib/diff";
// Fully static: these are built at deploy time, cost nothing to serve, and
// are what search engines can actually index (the main app is client-rendered).
export const dynamic = "force-static";
export function generateStaticParams() {
  return PAIRS.map((pair) => ({ slug: pair.slug }));
}
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
// Deterministic formatting — no locale dependency, so the build output is
// identical everywhere.
function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}
// "a Oracle SQL migration" reads badly; pick the article from the first sound.
function article(word) {
  return /^[AEIOU]/i.test(word) ? "an" : "a";
}
/**
 * One source of truth for the FAQ. The visible list and the JSON-LD are both
 * generated from this, so they can never drift apart — Google treats FAQ
 * schema that is not visible on the page as a violation.
 */
function buildFaq(pair) {
  return [
    {
      q: `How do I convert ${pair.source} to ${pair.target}?`,
      a: `Paste your ${pair.source} code into CodeShift AI, select ${pair.target} as the target, and the converter rewrites it. You get a line-by-line diff showing exactly what changed, plus notes on why. No signup is required.`
    },
    {
      q: `Is the ${pair.source} to ${pair.target} converter free?`,
      a: "Yes. Three conversions per day are free with no account and no credit card."
    },
    {
      q: `Can I trust the converted ${pair.target} code?`,
      a: `Always review and test it. Automated conversion handles syntax reliably, but semantic differences between ${pair.source} and ${pair.target} can change behaviour without causing an error. The known pitfalls for this pair are listed on this page.`
    },
    {
      q: `What is the hardest part of ${article(pair.source)} ${pair.source} to ${pair.target} migration?`,
      a: `Not the syntax — that is mechanical, and a converter handles it. The hard part is the behaviour that changes without erroring. ${pair.gotchas[0]} Differences like that pass every build and surface later as wrong results, which is why this page lists them alongside the mapping table.`
    },
    {
      q: `Can it convert a whole ${pair.source} file at once?`,
      a: `Up to 200 lines or 12,000 characters per conversion. For a larger file, split it into logical sections — functions, procedures or individual statements — and convert them one at a time. Smaller chunks also produce a diff you can actually read, which matters more than doing it in one pass.`
    }
  ];
}
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const pair = getPair(slug);
  if (!pair) return { title: "Converter not found" };
  const title = `${pair.source} to ${pair.target} Converter — Free Online Tool`;
  const description = `Convert ${pair.source} to ${pair.target} instantly. Free, no signup. Includes a syntax mapping table, a worked before/after example and the migration pitfalls that cause silent bugs.`;
  return {
    title,
    description,
    alternates: { canonical: `/convert/${pair.slug}` },
    openGraph: { title, description, type: "article", modifiedTime: LAST_UPDATED }
  };
}
/**
 * The worked example, rendered through the same diff engine the live tool
 * uses. This runs at build time from hardcoded strings — no model call, no
 * runtime cost, and the styling matches what people see after converting.
 */
function ExampleDiff({ example }) {
  const rows = diffLines(example.before, example.after);
  const stats = countChanges(rows);
  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
      <div className="px-4 py-1.5 border-b border-slate-800 text-xs text-slate-400 flex gap-3 items-center">
        <span className="text-emerald-400">+{stats.added} added</span>
        <span className="text-rose-400">-{stats.removed} removed</span>
        <span className="ml-auto text-slate-500">{example.title}</span>
      </div>
      <div className="overflow-x-auto font-mono text-sm">
        {rows.map((row, index) => {
          const tone =
            row.type === "added"
              ? "bg-emerald-500/10 text-emerald-200"
              : row.type === "removed"
              ? "bg-rose-500/10 text-rose-200"
              : "text-slate-300";
          const sign = row.type === "added" ? "+" : row.type === "removed" ? "-" : " ";
          return (
            <div key={index} className={`flex ${tone}`}>
              <span className="w-10 shrink-0 px-1 text-right text-slate-600 select-none">
                {row.leftNumber ?? ""}
              </span>
              <span className="w-10 shrink-0 px-1 text-right text-slate-600 select-none">
                {row.rightNumber ?? ""}
              </span>
              <span className="w-4 shrink-0 select-none opacity-70">{sign}</span>
              <span className="whitespace-pre-wrap break-words pr-4">{row.text || " "}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default async function ConvertPage({ params }) {
  const { slug } = await params;
  const pair = getPair(slug);
  if (!pair) notFound();
  const others = PAIRS.filter((p) => p.slug !== pair.slug).slice(0, 6);
  const faq = buildFaq(pair);
  const updated = formatDate(LAST_UPDATED);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a }
    }))
  };
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-4">
        <Link href="/" className="font-bold text-lg tracking-tight hover:text-indigo-400 transition">
          CodeShift AI
        </Link>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
          {pair.source} to {pair.target} Converter
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          Last updated <time dateTime={LAST_UPDATED}>{updated}</time> · {pair.mappings.length} syntax
          mappings · {pair.gotchas.length} migration pitfalls
        </p>
        <p className="mt-3 text-slate-400 text-lg">{pair.blurb}</p>
        <Link
          href={`/?from=${encodeURIComponent(pair.source)}&to=${encodeURIComponent(pair.target)}`}
          className="inline-block mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg transition"
        >
          Convert {pair.source} to {pair.target} now — free, no signup
        </Link>
        <section className="mt-12">
          <h2 className="text-xl font-bold text-white mb-1">Syntax mapping</h2>
          <p className="text-sm text-slate-500 mb-4">
            The equivalents that come up most often in {article(pair.source)} {pair.source} to{" "}
            {pair.target} migration.
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-300 border-b border-slate-800">
                    {pair.source}
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-300 border-b border-slate-800">
                    {pair.target}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pair.mappings.map(([from, to]) => (
                  <tr key={from} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-4 py-2 font-mono text-rose-300 align-top">{from}</td>
                    <td className="px-4 py-2 font-mono text-emerald-300 align-top">{to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="mt-10">
          <h2 className="text-xl font-bold text-white mb-1">
            Worked example: {pair.source} to {pair.target}
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            A complete conversion, shown exactly the way the tool shows it — removed lines in red,
            added lines in green, with the original and new line numbers side by side.
          </p>
          <ExampleDiff example={pair.example} />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="px-4 py-1.5 border-b border-slate-800 text-xs font-semibold text-rose-300">
                Before — {pair.source}
              </div>
              <pre className="p-4 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre">
                {pair.example.before}
              </pre>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="px-4 py-1.5 border-b border-slate-800 text-xs font-semibold text-emerald-300">
                After — {pair.target}
              </div>
              <pre className="p-4 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre">
                {pair.example.after}
              </pre>
            </div>
          </div>
          <p className="mt-4 bg-slate-900 border border-slate-800 border-l-2 border-l-indigo-500 rounded-lg px-4 py-3 text-slate-300 text-sm">
            <span className="font-semibold text-indigo-300">Why it matters: </span>
            {pair.example.note}
          </p>
        </section>
        <section className="mt-10">
          <h2 className="text-xl font-bold text-white mb-1">
            What silently breaks in {article(pair.source)} {pair.source} to {pair.target} migration
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            These do not throw errors. They change behaviour, which is worse.
          </p>
          <ul className="space-y-3">
            {pair.gotchas.map((g, i) => (
              <li
                key={i}
                className="bg-slate-900 border border-slate-800 border-l-2 border-l-amber-500 rounded-lg px-4 py-3 text-slate-300 text-sm"
              >
                {g}
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-10 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-3">
            How to convert {pair.source} to {pair.target}
          </h2>
          <ol className="list-decimal list-inside text-slate-300 space-y-1.5 text-sm">
            <li>Open the converter and paste your {pair.source} code.</li>
            <li>Set the source to {pair.source} and the target to {pair.target}.</li>
            <li>Click Translate. The result appears with a line-by-line diff.</li>
            <li>Read the diff, not just the output — it shows exactly which lines changed.</li>
            <li>Check the flagged pitfalls above, then test the converted code.</li>
          </ol>
          <Link
            href={`/?from=${encodeURIComponent(pair.source)}&to=${encodeURIComponent(pair.target)}`}
            className="inline-block mt-5 text-indigo-400 hover:text-indigo-300 font-medium text-sm"
          >
            Open the converter →
          </Link>
        </section>
        <section className="mt-10">
          <h2 className="text-xl font-bold text-white mb-4">
            {pair.source} to {pair.target}: frequently asked questions
          </h2>
          <div className="space-y-3">
            {faq.map((item, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
                <h3 className="font-semibold text-white text-sm">{item.q}</h3>
                <p className="mt-1.5 text-slate-400 text-sm">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mt-10">
          <h2 className="text-xl font-bold text-white mb-4">Other conversions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {others.map((p) => (
              <Link
                key={p.slug}
                href={`/convert/${p.slug}`}
                className="bg-slate-900 border border-slate-800 hover:border-indigo-600 rounded-lg px-4 py-2.5 text-sm text-slate-300 hover:text-white transition"
              >
                {p.source} → {p.target}
              </Link>
            ))}
          </div>
          <Link
            href="/convert"
            className="inline-block mt-4 text-indigo-400 hover:text-indigo-300 font-medium text-sm"
          >
            View all converters →
          </Link>
        </section>
        <p className="mt-10 text-xs text-slate-600">
          Automated conversion is a starting point, not a guarantee. Always review and test
          converted code before running it against production data. Page last reviewed {updated}.
        </p>
      </main>
    </div>
  );
}
