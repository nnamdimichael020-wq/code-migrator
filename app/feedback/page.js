"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Send Feedback",
  description:
    "Experiencing issues with CodeShift AI, missing a feature, or had a bad conversion? Send a note straight to the developer.",
  alternates: { canonical: "/feedback" }
};

const CATEGORIES = ["Issue", "Missing feature", "Expectation", "Conversion problem", "Other"];

export default function FeedbackPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("Issue");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { type: "ok" | "err", text }

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, category, note })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send feedback.");
      // Success confirmed — only now clear the form.
      setName("");
      setEmail("");
      setCategory("Issue");
      setNote("");
      setStatus({ type: "ok", text: "Thanks — your note was sent to the developer." });
    } catch (err) {
      // Keep every field so nothing is lost on failure.
      setStatus({ type: "err", text: err.message || "Could not send feedback. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const labelClass = "mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-400";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-4">
        <Link href="/" className="font-bold text-lg tracking-tight hover:text-indigo-400 transition">
          CodeShift AI
        </Link>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Send feedback</h1>
        <p className="mt-2 text-sm text-slate-400">
          Experiencing issues? Missing a feature? Less than you expected? Trouble converting?
          Send a note straight to the developer — it lands in the inbox, not a black hole.
        </p>

        <form onSubmit={submit} className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <label htmlFor="fb-name" className={labelClass}>
            Name
          </label>
          <input
            id="fb-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            placeholder="Your name"
            className={inputClass}
          />

          <label htmlFor="fb-email" className={labelClass}>
            Email
          </label>
          <input
            id="fb-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
            placeholder="you@example.com"
            className={inputClass}
          />

          <label htmlFor="fb-category" className={labelClass}>
            Category
          </label>
          <select
            id="fb-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label htmlFor="fb-note" className={labelClass}>
            Note
          </label>
          <textarea
            id="fb-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            maxLength={2000}
            rows={5}
            placeholder="What happened? What did you expect? What would help?"
            className={`${inputClass} resize-y`}
          />

          <p className="mt-3 text-[11px] text-slate-500">
            Don&apos;t include passwords, API keys or production data in your note.
          </p>

          {status && (
            <p className={`mt-3 text-sm ${status.type === "ok" ? "text-emerald-400" : "text-rose-400"}`}>
              {status.text}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
          >
            <Send className="w-4 h-4" />
            {busy ? "Sending…" : "Send"}
          </button>
        </form>
      </main>
    </div>
  );
}
