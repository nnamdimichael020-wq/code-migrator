"use client";

import { useEffect, useState } from "react";
import { Star, Send } from "lucide-react";
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function StarRow({ value, size = "w-4 h-4" }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-700"}`}
        />
      ))}
    </span>
  );
}

export default function ReviewsClient() {
  const [reviews, setReviews] = useState([]);
  const [configured, setConfigured] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [stars, setStars] = useState(0);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { type: "ok" | "err", text }

  useEffect(() => {
    fetch("/api/reviews", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.configured) setConfigured(true);
        if (Array.isArray(data?.reviews)) setReviews(data.reviews);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (stars < 1) {
      setNotice({ type: "err", text: "Choose a star rating." });
      return;
    }
    if (!message.trim()) {
      setNotice({ type: "err", text: "Write a short review message." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars, message, name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit review.");
      if (data.review) setReviews((prev) => [data.review, ...prev]);
      setStars(0);
      setMessage("");
      setName("");
      setNotice({ type: "ok", text: "Thanks — your review was submitted." });
    } catch (err) {
      setNotice({ type: "err", text: err.message || "Could not submit review." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Reviews</h1>
        <p className="mt-2 text-sm text-slate-400">
          Real feedback from people migrating SQL and code. Reviews are public and shown on the
          homepage — no account needed.
        </p>

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-5" aria-labelledby="leave-review">
          <h2 id="leave-review" className="text-lg font-bold text-white">
            Leave a review
          </h2>
          <form onSubmit={submit} className="mt-4">
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Your rating
              </legend>
              <div className="mt-2 flex items-center gap-1" role="group" aria-label="Star rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setStars(n)}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    aria-pressed={stars >= n}
                    className="p-1 rounded hover:bg-slate-800 transition"
                  >
                    <Star
                      className={`w-7 h-7 ${stars >= n ? "fill-amber-400 text-amber-400" : "text-slate-600"}`}
                    />
                  </button>
                ))}
              </div>
            </fieldset>
            <label htmlFor="review-message" className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Review message
            </label>
            <textarea
              id="review-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="What was your migration like? Accuracy, diff, pitfalls…"
              className="mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <label htmlFor="review-name" className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Name <span className="text-slate-600 normal-case font-normal">(optional — shown as “Anonymous” if empty)</span>
            </label>
            <input
              id="review-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Ada Lovelace"
              className="mt-2 w-full max-w-xs bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {notice && (
              <p className={`mt-3 text-sm ${notice.type === "ok" ? "text-emerald-400" : "text-rose-400"}`}>
                {notice.text}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-4 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              <Send className="w-4 h-4" />
              {busy ? "Submitting…" : "Submit review"}
            </button>
          </form>
        </section>

        <section className="mt-10" aria-labelledby="all-reviews">
          <h2 id="all-reviews" className="text-lg font-bold text-white">
            All reviews
          </h2>
          {!loaded ? (
            <p className="mt-4 text-sm text-slate-500">Loading reviews…</p>
          ) : !configured ? (
            <p className="mt-4 text-sm text-slate-500">
              Reviews are not available yet. Please check back soon.
            </p>
          ) : reviews.length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-center">
              <p className="text-sm text-slate-400">No reviews yet.</p>
              <p className="mt-1 text-xs text-slate-500">
                Be the first — convert a snippet, then tell everyone how it went.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {reviews.map((review) => (
                <li key={review.id} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <StarRow value={review.stars} />
                    <span className="text-xs font-medium text-slate-200">
                      {review.displayName || "Anonymous"}
                    </span>
                    {review.sourceLang && review.targetLang && (
                      <span className="text-[11px] text-slate-500">
                        {review.sourceLang} → {review.targetLang}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-600">
                      {formatDate(review.createdAt)}
                    </span>
                  </div>
                  {review.message && (
                    <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">{review.message}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
