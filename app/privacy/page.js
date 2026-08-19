import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
  description:
    "How CodeShift AI handles the code you paste, usage counters, cookies and third-party services.",
  alternates: { canonical: "/privacy" }
};

const LAST_REVIEWED = "19 August 2026";

const SECTION_TITLE = "text-lg font-bold text-white mt-8 mb-2";
const PARAGRAPH = "text-sm text-slate-400 leading-relaxed";
const LIST = "mt-2 space-y-2 text-sm text-slate-400 leading-relaxed list-disc list-inside";
const LIST_STRONG = "font-semibold text-slate-200";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-4">
        <Link href="/" className="font-bold text-lg tracking-tight hover:text-indigo-400 transition">
          CodeShift AI
        </Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Privacy Policy</h1>
        <p className="mt-2 text-xs text-slate-500">Last reviewed {LAST_REVIEWED}.</p>
        <p className={`mt-5 ${PARAGRAPH}`}>
          CodeShift AI is a focused SQL and code migration tool: you paste a snippet, pick the
          source and target languages, and get a converted result with a diff and migration
          warnings. This policy explains, in plain terms, what data the service processes and
          why. It is written for the service as it actually works today.
        </p>

        <h2 className={SECTION_TITLE}>1. What we process</h2>
        <ul className={LIST}>
          <li>
            <span className={LIST_STRONG}>Code you paste for conversion.</span> The snippet and
            the language pair you select are sent to our conversion provider (Google&apos;s Gemini
            API) to produce the result. This is the core of the service: we cannot convert code
            without processing it. If you fill in the optional schema box, that DDL text is sent
            the same way, as context for the conversion.
          </li>
          <li>
            <span className={LIST_STRONG}>Quota and usage counters.</span> To enforce the free
            daily limit, we keep a counter of how many conversions a visitor has used today. The
            counter is stored in Cloudflare&apos;s key-value store, keyed by a browser identifier
            cookie and network address, and expires automatically after two days. We do not store
            the converted code or your pasted snippets in that store.
          </li>
          <li>
            <span className={LIST_STRONG}>Bot checks.</span> The translate action is protected by
            Cloudflare Turnstile. Turnstile tokens are verified with Cloudflare before a
            conversion runs.
          </li>
          <li>
            <span className={LIST_STRONG}>Basic technical logs.</span> Cloudflare and the hosting
            layer may record standard request data (timestamps, network address, request paths,
            status codes) for operations, security and abuse prevention.
          </li>
        </ul>

        <h2 className={SECTION_TITLE}>2. Why we process it</h2>
        <p className={PARAGRAPH}>
          The pasted code is processed to provide the conversion you asked for and nothing else.
          Usage counters exist to keep the free tier sustainable. Bot checks protect the service
          (and the free quota) from automated abuse. We do not use your snippets to train models,
          and we do not sell or rent your data to anyone.
        </p>

        <h2 className={SECTION_TITLE}>3. Cookies and local storage</h2>
        <ul className={LIST}>
          <li>
            <span className={LIST_STRONG}>A quota cookie (<code className="font-mono text-xs">cs_vid</code>).</span>{" "}
            Set when you first use the converter so the daily free limit follows you across page
            reloads. It is HttpOnly, Secure, SameSite=Lax, and lasts up to a year.
          </li>
          <li>
            <span className={LIST_STRONG}>Browser local storage.</span> Your conversion history
            and preferences (such as the Idiomatic/Literal choice and Diff/Result view) are saved
            in your own browser&apos;s local storage. They never leave your device and are never
            sent to our servers.
          </li>
        </ul>

        <h2 className={SECTION_TITLE}>4. Third parties</h2>
        <ul className={LIST}>
          <li>
            <span className={LIST_STRONG}>Cloudflare</span> hosts the site (Workers/Pages),
            provides the key-value store used for quota counters, and powers Turnstile.
          </li>
          <li>
            <span className={LIST_STRONG}>Google Gemini API</span> performs the actual code
            conversion. Snippets are transmitted to Google for that purpose.
          </li>
          <li>
            <span className={LIST_STRONG}>Payment provider (future).</span> If and when the Pro
            plan&apos;s checkout goes live, payment processing will be handled by a payment
            provider (such as Lemon Squeezy or Stripe) as the merchant of record. We will update
            this policy at that point and will not store your card details.
          </li>
        </ul>

        <h2 className={SECTION_TITLE}>5. Your rights and contact</h2>
        <p className={PARAGRAPH}>
          You can stop us processing your pasted code at any time by simply not using the
          converter — there is no account to delete. You can clear your browser&apos;s local
          storage and cookies at any time to remove history, preferences and the quota cookie. If
          you have questions about this policy or your data, contact us at{" "}
          <a href="mailto:nnamdimichael020@gmail.com" className="text-indigo-400 hover:text-indigo-300">
            nnamdimichael020@gmail.com
          </a>
          .
        </p>

        <h2 className={SECTION_TITLE}>6. Changes</h2>
        <p className={PARAGRAPH}>
          If the service changes how data is processed, this page will be updated and the
          &ldquo;Last reviewed&rdquo; date above will move. Continued use of the service after a
          change means you accept the updated policy.
        </p>

        <p className="mt-10 text-xs text-slate-600">
          Automated conversion is a starting point, not a guarantee. Always review and test
          converted code before running it against production data.
        </p>
      </main>
    </div>
  );
}
