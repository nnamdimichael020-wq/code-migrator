import Link from "next/link";
import { notFound } from "next/navigation";
import { PAIRS, getPair } from "../../../lib/pairs";
// Fully static: these are built at deploy time, cost nothing to serve, and
// are what search engines can actually index (the main app is client-rendered).
export const dynamic = "force-static";
export function generateStaticParams() {
  return PAIRS.map((pair) => ({ slug: pair.slug }));
}
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const pair = getPair(slug);
  if (!pair) return { title: "Converter not found" };
  const title = `${pair.source} to ${pair.target} Converter — Free Online Tool`;
  const description = `Convert ${pair.source} to ${pair.target} instantly. Free, no signup. Includes a syntax mapping table and the migration pitfalls that cause silent bugs.`;
  return {
    title,
    description,
    alternates: { canonical: `/convert/${pair.slug}` },
    openGraph: { title, description, type: "article" }
  };
}
export default async function ConvertPage({ params }) {
  const { slug } = await params;
  const pair = getPair(slug);
  if (!pair) notFound();
  const others = PAIRS.filter((p) => p.slug !== pair.slug).slice(0, 6);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `How do I convert ${pair.source} to ${pair.target}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Paste your ${pair.source} code into CodeShift AI, select ${pair.target} as the target, and the converter rewrites it. You get a line-by-line diff showing exactly what changed, plus notes on why. No signup is required.`
        }
      },
      {
        "@type": "Question",
        name: `Is the ${pair.source} to ${pair.target} converter free?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Three conversions per day are free with no account and no credit card."
        }
      },
      {
        "@type": "Question",
        name: `Can I trust the converted ${pair.target} code?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Always review and test it. Automated conversion handles syntax reliably, but semantic differences between ${pair.source} and ${pair.target} can change behaviour without causing an error. The known pitfalls for this pair are listed on this page.`
        }
      }
    ]
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
        <p className="mt-3 text-slate-400 text-lg">{pair.blurb}</p>
        <Link
          href="/"
          className="inline-block mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg transition"
        >
          Convert {pair.source} to {pair.target} now — free, no signup
        </Link>
        <section className="mt-12">
          <h2 className="text-xl font-bold text-white mb-1">Syntax mapping</h2>
          <p className="text-sm text-slate-500 mb-4">
            The equivalents that come up most often in a {pair.source} to {pair.target} migration.
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
            What silently breaks in a {pair.source} to {pair.target} migration
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
            href="/"
            className="inline-block mt-5 text-indigo-400 hover:text-indigo-300 font-medium text-sm"
          >
            Open the converter →
          </Link>
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
        </section>
        <p className="mt-10 text-xs text-slate-600">
          Automated conversion is a starting point, not a guarantee. Always review and test
          converted code before running it against production data.
        </p>
      </main>
    </div>
  );
}
