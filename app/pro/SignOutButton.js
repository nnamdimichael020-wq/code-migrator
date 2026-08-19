"use client";

import { useState } from "react";

export default function SignOutButton({ className = "" }) {
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the request fails, navigate home — the free tool works regardless.
    }
    window.location.href = "/";
  };

  return (
    <button type="button" onClick={signOut} disabled={busy} className={className}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
