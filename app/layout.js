import "./globals.css";

export const metadata = {
  title: "CodeShift AI - Instant SQL & Code Migration Tool",
  metadataBase: new URL("https://code-migrator.nnamdimichael020.workers.dev"),
  // Child pages override `title` via their own metadata export; this template
  // keeps the brand suffix consistent across every page.
  title: {
    default: "CodeShift AI - Instant SQL & Code Migration Tool",
    template: "%s | CodeShift AI"
  },
  description: "Migrate SQL queries and code dialects instantly using AI.",
};
