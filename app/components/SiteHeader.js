"use client";
import Link from "next/link";
import { ArrowLeft, Code2 } from "lucide-react";
import { usePathname } from "next/navigation";

export default function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  // Show "Back to converter" on every non-home page.
  // Also keep logo clickable to home.
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0 font-bold text-lg tracking-tight hover:text-indigo-400 transition"
          aria-label="CodeShift AI home"
        >
          <Code2 className="w-6 h-6 text-indigo-400" />
          <span>CodeShift AI</span>
        </Link>

        {/* Primary nav - visible on sm+ to keep mobile clean but still allow back */}
        <nav
          className="hidden sm:flex items-center gap-3 sm:gap-5 text-xs sm:text-sm text-slate-400 whitespace-nowrap overflow-x-auto min-w-0 flex-1"
          aria-label="Primary navigation"
        >
          <Link href="/convert" className="hover:text-white transition">
            Conversion Guides
          </Link>
          <Link href="/reviews" className="hover:text-white transition">
            Reviews
          </Link>
          <Link href="/#pricing" className="hover:text-white transition">
            Pricing
          </Link>
          <Link href="/#faq" className="hover:text-white transition">
            FAQs
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
          {/* Always visible on any page except home as a clear escape hatch */}
          {!isHome && (
            <Link
              href="/#translator"
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to converter</span>
              <span className="sm:hidden">Back</span>
            </Link>
          )}
          {/* Extra prominent CTA to converter when not home */}
          {!isHome && (
            <Link
              href="/"
              className="hidden sm:inline-flex bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition"
            >
              Open converter
            </Link>
          )}
          {/* Mobile extra nav fallback: show Guides link if nav hidden */}
          <Link
            href="/convert"
            className="sm:hidden text-xs text-slate-400 hover:text-slate-200 transition"
          >
            Guides
          </Link>
        </div>
      </div>
    </header>
  );
}
