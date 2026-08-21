import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { kvConfig } from "../../../lib/kv.js";
import { authConfig, verifyToken, getUser, setUserPlan, SESSION_COOKIE } from "../../../lib/auth.js";
import { billingConfig, retrieveCheckoutSession } from "../../../lib/billing.js";
import { PRO_MAX_LINES } from "../../../lib/limits.js";
import SiteHeader from "../../components/SiteHeader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pro activated",
  robots: { index: false, follow: false }
};

export default async function ProSuccessPage({ searchParams }) {
  const auth = authConfig();
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  let session = null;
  if (auth.sessionSecret && raw) session = await verifyToken(raw, auth.sessionSecret);
  if (!session) redirect("/api/auth/google");

  const params = await searchParams;
  const sessionId = typeof params?.session_id === "string" ? params.session_id : "";
  const email = session.email || "";

  // Confirm the payment server-side and flip the plan ourselves, rather than
  // trusting the redirect. The webhook remains the safety net (and covers
  // renewals/cancellations); this makes the flip immediate and deterministic.
  let confirmed = false;
  let pending = false;
  const billing = billingConfig();
  const kv = kvConfig();

  if (sessionId && billing.secretKey && kv) {
    try {
      const checkout = await retrieveCheckoutSession({
        secretKey: billing.secretKey,
        sessionId
      });
      const payerMatches =
        checkout?.metadata?.googleId === session.sub ||
        checkout?.client_reference_id === session.sub;
      if (payerMatches && checkout?.status === "complete" && checkout?.payment_status === "paid") {
        await setUserPlan(kv, session.sub, "pro", {
          stripeCustomerId: checkout.customer || null,
          stripeSubscriptionId: checkout.subscription || null
        });
        confirmed = true;
      } else if (payerMatches) {
        // Session exists but hasn't settled — the webhook will land shortly.
        pending = true;
      }
    } catch {
      pending = true;
    }
  } else if (sessionId) {
    // Billing env missing or KV down: the signed webhook still applies the
    // plan when configured; don't claim success we can't verify.
    pending = true;
  }

  // If the webhook already flipped the record before the redirect landed,
  // read it back and celebrate accurately.
  if (!confirmed && kv) {
    try {
      const user = await getUser(kv, session.sub);
      if (user?.plan === "pro") confirmed = true;
    } catch {
      // fall through with what we have
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="max-w-2xl mx-auto px-6 py-14">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          {confirmed ? (
            <>
              <div className="w-12 h-12 bg-emerald-500/15 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                ✓
              </div>
              <h1 className="mt-4 text-2xl font-extrabold text-white">You&apos;re on Pro</h1>
              <p className="mt-3 text-sm text-slate-400">
                Payment complete — signed in as{" "}
                <span className="font-semibold text-slate-200">{email}</span>. Your conversions
                are now unlimited, and single scripts up to {PRO_MAX_LINES} lines convert
                without splitting.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold text-white">
                Payment received — activating Pro
              </h1>
              <p className="mt-3 text-sm text-slate-400">
                We&apos;re confirming your payment now. This usually takes a few seconds;
                refresh this page or reopen the converter in a moment. Nothing further is
                needed from you.
              </p>
              {pending && (
                <p className="mt-2 text-xs text-slate-500">
                  If Pro doesn&apos;t appear within a few minutes, reply to your Stripe
                  receipt email and we&apos;ll sort it out.
                </p>
              )}
            </>
          )}

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
            >
              Back to converter
            </Link>
            <Link
              href="/pro"
              className="text-xs text-slate-400 hover:text-slate-200 transition px-3 py-2"
            >
              Pro account
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
