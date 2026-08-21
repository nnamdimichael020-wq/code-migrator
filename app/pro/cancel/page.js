import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";

export const metadata = {
  title: "Checkout cancelled",
  robots: { index: false, follow: false }
};

export default function ProCancelPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="max-w-2xl mx-auto px-6 py-14">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <h1 className="text-2xl font-extrabold text-white">Checkout cancelled</h1>
          <p className="mt-3 text-sm text-slate-400">
            You stopped before paying, so <span className="font-semibold text-slate-200">you
            haven&apos;t been charged</span>. Your account stays on the free plan — 3
            conversions a day, no account needed.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/pro"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
            >
              Try again
            </Link>
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-slate-200 transition px-3 py-2"
            >
              Back to the converter
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
