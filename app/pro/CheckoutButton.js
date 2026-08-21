"use client";

import { useState } from "react";
import { Zap } from "lucide-react";

export default function CheckoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const startCheckout = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await res.json();
      if (res.status === 401) {
        // Session expired mid-flow — restart from Google sign-in.
        window.location.href = "/api/auth/google";
        return;
      }
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout. Please try again.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err?.message || "Could not start checkout. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={startCheckout}
        disabled={busy}
        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition flex items-center gap-2"
      >
        <Zap className="w-4 h-4" />
        {busy ? "Opening Stripe…" : "Continue to payment — $7/month"}
      </button>
      {error && <p className="text-xs text-rose-400 max-w-sm text-center">{error}</p>}
    </div>
  );
}
