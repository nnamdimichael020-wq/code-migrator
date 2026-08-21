"use client";

import { useEffect, useState } from "react";

// Webhooks are near-instant but not guaranteed to beat the redirect. While
// the success page is in its "activating" state, poll /api/auth/me (which
// reads the STORED plan) and refresh the page the moment Pro lands.
export default function ActivationPoller() {
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = setInterval(async () => {
      if (cancelled) return;
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.plan === "pro") {
          cancelled = true;
          clearInterval(timer);
          window.location.reload();
          return;
        }
      } catch {
        // keep polling — transient network errors are fine
      }
      setTries((n) => n + 1);
    }, 4000);
    const stop = () => {
      cancelled = true;
      clearInterval(timer);
    };
    window.addEventListener("beforeunload", stop);
    return () => {
      stop();
      window.removeEventListener("beforeunload", stop);
    };
  }, []);

  return (
    <p className="mt-3 text-xs text-slate-500" aria-live="polite">
      {tries > 15
        ? "Still confirming… it can take a minute. Leave this tab open, or refresh later."
        : "Waiting for confirmation…"}
    </p>
  );
}
