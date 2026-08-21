import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { kvConfig } from "../../../lib/kv.js";
import { authConfig, verifyToken, getUser, setUserPlan, SESSION_COOKIE } from "../../../lib/auth.js";
import {
  billingConfig,
  getCheckoutMapping,
  retrieveLemonCheckout,
  checkoutIsPaid
} from "../../../lib/billing.js";
import { PRO_MAX_LINES } from "../../../lib/limits.js";
import SiteHeader from "../../components/SiteHeader";
import ActivationPoller from "../ActivationPoller";

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
  const token = typeof params?.c === "string" ? params.c.slice(0, 80) : "";
  const email = session.email || "";

  // Confirm the payment server-side rather than trusting the redirect: our
  // confirm token maps to the payer in KV, and the Lemon Squeezy checkout is
  // fetched back from the API and must read as paid. The signed webhook
  // remains the safety net (renewals, cancellations); this makes the flip
  // immediate when both work.
  let confirmed = false;
  let pending = false;
  const billing = billingConfig();
  const kv = kvConfig();

  if (token && billing.apiKey && kv) {
    try {
      const mapping = await getCheckoutMapping(kv, token);
      if (mapping && mapping.googleId === session.sub) {
        if (mapping.lemonCheckoutId) {
          const checkout = await retrieveLemonCheckout({
            apiKey: billing.apiKey,
            checkoutId: mapping.lemonCheckoutId
          });
          if (checkoutIsPaid(checkout)) {
            await setUserPlan(kv, session.sub, "pro", {
              lemonCheckoutId: mapping.lemonCheckoutId
            });
            confirmed = true;
          } else {
            pending = true;
          }
        }
      } else if (mapping) {
        // Token belongs to a different account — never flip someone else.
        pending = false;
      } else {
        pending = true;
      }
    } catch {
      pending = true;
    }
  } else if (token) {
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
              <p className="mt-2 text-xs text-slate-500">
                Lemon Squeezy emailed your receipt and subscription link — that link is also
                where you cancel any time.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold text-white">
                Payment received — activating Pro
              </h1>
              <p className="mt-3 text-sm text-slate-400">
                We&apos;re confirming your payment with Lemon Squeezy now. This usually takes
                a few seconds — this page updates itself, no action needed from you.
              </p>
              <ActivationPoller />
              {pending && (
                <p className="mt-3 text-xs text-slate-500">
                  If Pro doesn&apos;t appear within a few minutes, use the contact link in the
                  footer with your receipt email and we&apos;ll sort it out.
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
