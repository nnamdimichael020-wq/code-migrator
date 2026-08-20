import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPages, getPair, LAST_UPDATED, relatedPages } from "../../../lib/pairs";
import GuideSandbox from "../GuideSandbox";
import SiteHeader from "../../components/SiteHeader";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllPages().map((pair) => ({ slug: pair.slug }));
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

function article(word) {
  return /^[AEIOU]/i.test(word) ? "an" : "a";
}

function ownHref(pair) {
  return `/?from=${encodeURIComponent(pair.source)}&to=${encodeURIComponent(pair.target)}#translator`;
}

function buildFaq(pair) {
  return [
    {
      q: `How do I convert ${pair.source} to ${pair.target}?`,
      a: `The sample on this page is already converted. To convert your own code, click Translate Your Own Code — the live tool opens with ${pair.source} → ${pair.target} selected. No signup.`
    },
    {
      q: `Is the ${pair.source} to ${pair.target} converter free?`,
      a: "Yes. Three conversions per day are free with no account and no credit card. The sample on this page does not use one of those."
    },
    {
      q: `Can I trust the converted ${pair.target} code?`,
      a: `Always review and test it. Automated conversion handles syntax reliably, but semantic differences between ${pair.source} and ${pair.target} can change behaviour without causing an error. The known pitfalls for this pair are listed on this page.`
    },
    {
      q: `What is the hardest part of ${article(pair.source)} ${pair.source} to ${pair.target} migration?`,
      a: `Not the syntax — that is mechanical. The hard part is the behaviour that changes without erroring. ${pair.gotchas[0]} Differences like that pass every build and surface later as wrong results.`
    },
    {
      q: `Can it convert a whole ${pair.source} file at once?`,
      a: "Up to 200 lines or 12,000 characters per conversion. For a larger file, split it into logical sections and convert them one at a time."
    }
  ];
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const pair = getPair(slug);
  if (!pair) return { title: "Converter not found" };
  const heading = pair.title || `${pair.source} to ${pair.target} Converter`;
  const title = `${heading} — Free Online Tool`;
  const description = `Convert ${pair.source} to ${pair.target} instantly. Free, no signup. Pre-filled example, syntax mapping, and the migration pitfalls that cause silent bugs.`;
  return {
    title,
    description,
    alternates: { canonical: `/convert/${pair.slug}` },
    openGraph: { title, description, type: "article", modifiedTime: LAST_UPDATED }
  };
}

export default async function ConvertPage({ params }) {
  const { slug } = await params;
  const pair = getPair(slug);
  if (!pair) notFound();
  const related = relatedPages(pair.slug);
  const others = getAllPages()
    .filter((p) => p.slug !== pair.slug && !related.some((r) => r.slug === p.slug))
    .slice(0, 6);
  const faq = buildFaq(pair);
  const updated = formatDate(LAST_UPDATED);
  const heading = pair.title || `${pair.source} to ${pair.target} Converter`;
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
      <SiteHeader />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">{heading}</h1>
        <p className="mt-2 text-xs text-slate-500">
          Last updated <time dateTime={LAST_UPDATED}>{updated}</time> · {pair.mappings.length} syntax
          mappings · {pair.gotchas.length} migration pitfalls
        </p>
        <p className="mt-3 text-slate-400 text-lg">{pair.blurb}</p>

        <GuideSandbox
          source={pair.source}
          target={pair.target}
          before={pair.example.before}
          after={pair.example.after}
          ownHref={ownHref(pair)}
        />

        {pair.example.note && (
          <p className="mt-4 bg-slate-900 border border-slate-800 border-l-2 border-l-indigo-500 rounded-lg px-4 py-3 text-slate-300 text-sm">
            <span className="font-semibold text-indigo-300">Why it matters: </span>
            {pair.example.note}
          </p>
        )}

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
            Convert your own {pair.source} to {pair.target}
          </h2>
          <ol className="list-decimal list-inside text-slate-300 space-y-1.5 text-sm">
            <li>Click Translate Your Own Code above. The live tool opens with both languages set.</li>
            <li>Paste your {pair.source} in the left pane.</li>
            <li>Click Translate. The result appears with a line-by-line diff.</li>
            <li>Read the silent-issues count — it flags behaviour that can change without erroring.</li>
            <li>Test the converted code before you ship it.</li>
          </ol>
          <Link
            href={ownHref(pair)}
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

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-white mb-4">More on this pair</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  href={`/convert/${p.slug}`}
                  className="bg-slate-900 border border-slate-800 hover:border-indigo-600 rounded-lg px-4 py-2.5 text-sm text-slate-300 hover:text-white transition"
                >
                  {p.title || `${p.source} → ${p.target}`}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-xl font-bold text-white mb-4">Other conversions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {others.map((p) => (
              <Link
                key={p.slug}
                href={`/convert/${p.slug}`}
                className="bg-slate-900 border border-slate-800 hover:border-indigo-600 rounded-lg px-4 py-2.5 text-sm text-slate-300 hover:text-white transition"
              >
                {p.title || `${p.source} → ${p.target}`}
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
        <p className="mt-3 text-xs text-slate-600">
          <Link href="/reviews" className="text-indigo-400 hover:text-indigo-300">Leave a review</Link>
          <span className="mx-2 text-slate-700">·</span>
          <Link href="/feedback" className="text-indigo-400 hover:text-indigo-300">Send feedback</Link>
        </p>
      </main>
    </div>
  );
}
