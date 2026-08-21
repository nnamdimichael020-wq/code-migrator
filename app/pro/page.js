import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Check } from "lucide-react";
import { kvConfig } from "../../lib/kv.js";
import { authConfig, verifyToken, getUser, SESSION_COOKIE } from "../../lib/auth.js";
import { isBillingConfigured } from "../../lib/billing.js";
import { PRO_MAX_LINES } from "../../lib/limits.js";
import SignOutButton from "./SignOutButton";
import CheckoutButton from "./CheckoutButton";
import SiteHeader from "../components/SiteHeader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pro",
  robots: { index: false, follow: false }
};

export default async function ProPage() {
  const config = authConfig();
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  let session = null;
  if (config.sessionSecret && raw) session = await verifyToken(raw, config.sessionSecret);
  // The Pro page is only reachable through the Go Pro flow.
  if (!session) redirect("/api/auth/google");

  // Fresh plan from the user record when KV is available.
  let plan = session.plan === "pro" ? "pro" : "free";
  const kv = kvConfig();
  if (kv) {
    try {
      const user = await getUser(kv, session.sub);
      if (user) plan = user.plan === "pro" ? "pro" : "free";
    } catch {
      // Cookie plan is fine.
    }
  }

  const email = session.email || "";
  const checkoutReady = isBillingConfigured();
  // Honest feature list — every line is enforced server-side.
  const features = [
    "Unlimited daily conversions",
    `Single scripts up to ${PRO_MAX_LINES} lines (vs 200 on free)`,
    "Every language pair, Diff, pitfall warnings and schema context"
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="max-w-2xl mx-auto px-6 py-14">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          {plan === "pro" ? (
            <>
              <h1 className="text-2xl font-extrabold text-white">You&apos;re on Pro</h1>
              <p className="mt-3 text-sm text-slate-400">
                Signed in as <span className="font-semibold text-slate-200">{email}</span>.
                Your conversions are unlimited and single scripts up to {PRO_MAX_LINES} lines
                convert without splitting.
              </p>
            </>
          ) : checkoutReady ? (
            <>
              <h1 className="text-2xl font-extrabold text-white">Upgrade to Pro</h1>
              <p className="mt-3 text-sm text-slate-400">
                Signed in as <span className="font-semibold text-slate-200">{email}</span>.
                Pay securely with Stripe — your account flips to Pro the moment payment
                completes.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold text-white">Pro checkout is almost ready</h1>
              <p className="mt-3 text-sm text-slate-400">
                Signed in as <span className="font-semibold text-slate-200">{email}</span>.
                Checkout is being configured on the server right now — your free daily
                conversions keep working in the meantime.
              </p>
            </>
          )}

          <div className="mt-6 rounded-xl bg-slate-800/60 border border-slate-700 p-4 text-left">
            <div className="text-2xl font-black text-white">
              $7 <span className="text-xs font-normal text-slate-400">/ month</span>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
              {features.map((f) => (
                <li key={f} className="flex gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {plan === "pro" ? (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
              >
                Back to converter
              </Link>
              <SignOutButton className="text-xs text-slate-400 hover:text-slate-200 transition px-3 py-2" />
            </div>
          ) : checkoutReady ? (
            <div className="mt-6 flex flex-col items-center gap-3">
              <CheckoutButton />
              <p className="text-[11px] text-slate-500">
                Secure payment by Stripe. Cancel any time by replying to your receipt email
                or contacting us — you keep Pro until the period ends.
              </p>
              <div className="mt-1 flex items-center gap-4 text-xs">
                <Link href="/" className="text-slate-400 hover:text-slate-200 transition">
                  Not now — back to the converter
                </Link>
                <SignOutButton className="text-slate-400 hover:text-slate-200 transition px-2 py-1" />
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
              >
                Back to converter
              </Link>
              <SignOutButton className="text-xs text-slate-400 hover:text-slate-200 transition px-3 py-2" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
