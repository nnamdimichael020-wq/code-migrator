import Link from "next/link";
import SiteHeader from "../components/SiteHeader";

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
      <SiteHeader />
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
            <span className={LIST_STRONG}>Reviews.</span> If you submit a review, the star rating,
            message, optional display name, the language pair (if included) and a timestamp are
            stored and shown publicly on the site.
          </li>
          <li>
            <span className={LIST_STRONG}>Feedback form.</span> If you use the feedback form, your
            name, email address, category and note are sent to the developer&apos;s inbox so the
            message can be answered.
          </li>
          <li>
            <span className={LIST_STRONG}>Google Sign-In (optional).</span> If you choose to sign
            in with Google — which is only offered at the Pro gate — we receive your Google user
            ID, email address and basic profile name (if available). This is used to identify
            your account for a future Pro entitlement and to manage your session. Free
            conversions never require signing in.
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

        <h2 className={SECTION_TITLE}>3. Reviews</h2>
        <p className={PARAGRAPH}>
          Reviews are public by design: the rating, message, optional display name and date
          appear on the Reviews page and in the rotating widget on the homepage. No account is
          needed to leave one. We strip HTML from reviews, remove obvious spam, and can remove a
          review on request (see contact details below). Reviews are kept while the service runs;
          there is no automatic expiry.
        </p>

        <h2 className={SECTION_TITLE}>4. Feedback form</h2>
        <p className={PARAGRAPH}>
          Feedback submissions are delivered by email to the developer so issues and requests can
          be answered. The email address you provide is used only to reply — it is not added to a
          mailing list, and is not sold or shared. Feedback emails are kept in the developer&apos;s
          inbox like ordinary email and can be deleted on request. Never include passwords, API
          keys or production data in a feedback note.
        </p>

        <h2 className={SECTION_TITLE}>5. Cookies and local storage</h2>
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
          <li>
            <span className={LIST_STRONG}>Session cookie (<code className="font-mono text-xs">cs_session</code>).</span>{" "}
            Set only when you sign in with Google. It is a signed, HttpOnly, Secure, SameSite=Lax
            cookie that identifies your account for up to 30 days. Signing out removes it.
          </li>
          <li>
            <span className={LIST_STRONG}>OAuth state cookie (<code className="font-mono text-xs">cs_oauth_state</code>).</span>{" "}
            A short-lived (10-minute), HttpOnly cookie used during the Google sign-in step to
            protect the login flow. It is deleted after sign-in completes.
          </li>
        </ul>

        <h2 className={SECTION_TITLE}>6. Sign-in and account data</h2>
        <p className={PARAGRAPH}>
          Sign-in is optional and only appears at the Pro gate; you can use the converter, the
          guides, reviews and the free daily quota without an account. When you sign in with
          Google, we store your Google user ID, email address, optional display name, a plan
          field (always &ldquo;free&rdquo; while billing is not live) and account timestamps in
          Cloudflare&apos;s key-value store. New accounts always start on the free plan. We do not
          receive or store your Google password, and we never set your plan to a paid state
          automatically.
        </p>

        <h2 className={SECTION_TITLE}>7. Third parties</h2>
        <ul className={LIST}>
          <li>
            <span className={LIST_STRONG}>Cloudflare</span> hosts the site (Workers/Pages),
            provides the key-value store used for quota counters, reviews and user accounts, and
            powers Turnstile.
          </li>
          <li>
            <span className={LIST_STRONG}>Google Gemini API</span> performs the actual code
            conversion. Snippets are transmitted to Google for that purpose.
          </li>
          <li>
            <span className={LIST_STRONG}>Google Sign-In</span> handles the OAuth sign-in step.
            Google shares your user ID, email and basic profile name with us (see Section 1 and
            Section 6); we never see your Google password.
          </li>
          <li>
            <span className={LIST_STRONG}>Resend</span> (or the configured transactional email
            provider) delivers feedback form submissions to the developer&apos;s inbox.
          </li>
          <li>
            <span className={LIST_STRONG}>Payment provider (future).</span> If and when the Pro
            plan&apos;s checkout goes live, payment processing will be handled by a payment
            provider (such as Lemon Squeezy or Stripe) as the merchant of record. We will update
            this policy at that point and will not store your card details.
          </li>
        </ul>

        <h2 className={SECTION_TITLE}>8. Your rights and contact</h2>
        <p className={PARAGRAPH}>
          You can stop us processing your pasted code at any time by simply not using the
          converter — there is no account required for that. If you signed in, you can sign out
          from the Pro page or clear the session cookie, which removes your session. You can
          clear your browser&apos;s local storage and cookies at any time to remove history,
          preferences and the quota cookie. To ask for a review to be removed, a feedback email
          deleted, or your account record deleted, contact us at{" "}
          <a href="mailto:nnamdimichael020@gmail.com" className="text-indigo-400 hover:text-indigo-300">
            nnamdimichael020@gmail.com
          </a>
          .
        </p>

        <h2 className={SECTION_TITLE}>9. Changes</h2>
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
