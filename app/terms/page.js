import Link from "next/link";
import SiteHeader from "../components/SiteHeader";

export const metadata = {
  title: "Terms of Service",
  description:
    "The terms for using CodeShift AI: free tier limits, the planned Pro plan, acceptable use, and disclaimers.",
  alternates: { canonical: "/terms" }
};

const LAST_REVIEWED = "19 August 2026";

const SECTION_TITLE = "text-lg font-bold text-white mt-8 mb-2";
const PARAGRAPH = "text-sm text-slate-400 leading-relaxed";
const LIST = "mt-2 space-y-2 text-sm text-slate-400 leading-relaxed list-disc list-inside";
const LIST_STRONG = "font-semibold text-slate-200";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Terms of Service</h1>
        <p className="mt-2 text-xs text-slate-500">Last reviewed {LAST_REVIEWED}.</p>
        <p className={`mt-5 ${PARAGRAPH}`}>
          By using CodeShift AI you agree to these terms. They are written in plain language and
          describe the service as it actually works today.
        </p>

        <h2 className={SECTION_TITLE}>1. What the service is</h2>
        <p className={PARAGRAPH}>
          CodeShift AI is an AI-assisted migration tool. You paste a code or SQL snippet, choose a
          source and target language, and receive a converted result together with a diff and
          warnings about differences that can change behaviour. The output is{" "}
          <span className="font-semibold text-slate-200">migration assistance, not a guarantee of
          production-ready code</span>. Automated conversion can miss semantic differences between
          languages, and you are responsible for reviewing and testing anything you deploy.
        </p>

        <h2 className={SECTION_TITLE}>2. The free tier</h2>
        <ul className={LIST}>
          <li>You get a limited number of free conversions per day (currently 3) with no account.</li>
          <li>Free conversions are capped at 200 lines or 12,000 characters per paste.</li>
          <li>
            The limit is enforced per browser identifier and network address. Attempting to
            bypass it — by rotating identifiers, addresses or automated scripts — is a breach of
            these terms.
          </li>
          <li>Conversion history and preferences are stored only in your own browser.</li>
          <li>The free tier does not require an account. Signing in is optional and only offered at the Pro gate.</li>
        </ul>

        <h2 className={SECTION_TITLE}>3. Pro plan ($7/month subscription)</h2>
        <p className={PARAGRAPH}>
          The Pro plan is a $7/month subscription purchased through Lemon Squeezy checkout.
          Lemon Squeezy is the merchant of record: it processes the payment, handles taxes,
          emails your receipt and subscription management link, and we never see or store
          your card details. Pro includes unlimited daily conversions and single scripts up
          to 500 lines.
        </p>
        <p className={`mt-3 ${PARAGRAPH}`}>
          <span className="font-semibold text-slate-200">Signing in with Google does not create a
          paid subscription or charge you.</span> You are charged only when you explicitly
          complete Lemon Squeezy checkout yourself. Your entitlement is applied to your account
          when Lemon Squeezy confirms the payment. If your subscription is cancelled, ends, or
          payment fails, your account returns to the free plan at the end of the paid period.
          To cancel, use the subscription management link in your Lemon Squeezy email, or
          contact us; you keep Pro until the period you paid for ends. Refunds follow Lemon
          Squeezy&apos;s policy and are handled case by case — contact us.
        </p>

        <h2 className={SECTION_TITLE}>4. Your responsibility for converted code</h2>
        <p className={PARAGRAPH}>
          You are responsible for reviewing the diff and the silent-pitfall warnings, testing the
          converted code in your own environment, and confirming it behaves correctly before
          using it. CodeShift AI is a productivity aid, not a substitute for a developer&apos;s
          judgement or for your own testing.
        </p>

        <h2 className={SECTION_TITLE}>5. Acceptable use</h2>
        <ul className={LIST}>
          <li>Do not use the service to convert or distribute illegal content.</li>
          <li>
            Do not automate the converter or script requests in a way that bypasses the free
            daily limit, the size caps, or the human verification check.
          </li>
          <li>Do not attempt to disrupt, overload, probe or reverse-engineer the service.</li>
          <li>Do not resell access to the free tier.</li>
        </ul>
        <p className={`mt-3 ${PARAGRAPH}`}>
          We may suspend or block access that violates these rules, with or without notice.
        </p>

        <h2 className={SECTION_TITLE}>6. Reviews</h2>
        <p className={PARAGRAPH}>
          By submitting a review you grant CodeShift AI permission to display it publicly on the
          site — the rating, message, optional name and date. Reviews must not be illegal,
          abusive, defamatory, misleading or infringing. We may edit or remove reviews at our
          discretion, including spam and off-topic submissions. A review is one person&apos;s
          experience of the tool; it does not change the disclaimers in these terms.
        </p>

        <h2 className={SECTION_TITLE}>7. Feedback</h2>
        <p className={PARAGRAPH}>
          Feedback you send through the form is provided as-is. We read it and try to respond,
          but we make no guarantee of a response time, and no promise that any requested feature
          will be built. Never include passwords, API keys or production data in a feedback note.
        </p>

        <h2 className={SECTION_TITLE}>8. Disclaimer of warranties</h2>
        <p className={PARAGRAPH}>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
          warranties of any kind, express or implied, including accuracy, fitness for a
          particular purpose, or uninterrupted availability. We do not warrant that converted
          code is error-free, secure, or suitable for your use case.
        </p>

        <h2 className={SECTION_TITLE}>9. Limitation of liability</h2>
        <p className={PARAGRAPH}>
          To the maximum extent permitted by law, CodeShift AI and its operators are not liable
          for any indirect, incidental, special, consequential or punitive damages — including
          lost data, lost profits or production outages — arising from your use of the service or
          reliance on converted code. Your sole remedy for any problem with the service is to
          stop using it.
        </p>

        <h2 className={SECTION_TITLE}>10. Changes to these terms</h2>
        <p className={PARAGRAPH}>
          We may update these terms as the service evolves — for example, when the Pro plan and
          checkout launch. Changes take effect when posted on this page, and the
          &ldquo;Last reviewed&rdquo; date above will be updated. Continued use of the service
          after a change means you accept the updated terms.
        </p>

        <h2 className={SECTION_TITLE}>11. Contact</h2>
        <p className={PARAGRAPH}>
          Questions about these terms can be sent to{" "}
          <a href="mailto:nnamdimichael020@gmail.com" className="text-indigo-400 hover:text-indigo-300">
            nnamdimichael020@gmail.com
          </a>
          .
        </p>

        <p className="mt-10 text-xs text-slate-600">
          Automated conversion is a starting point, not a guarantee. Always review and test
          converted code before running it against production data.
        </p>
      </main>
    </div>
  );
}
