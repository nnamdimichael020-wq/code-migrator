import "./globals.css";
export const metadata = {
  metadataBase: new URL("https://code-migrator.nnamdimichael020.workers.dev"),
  // Child pages override `title` via their own metadata export; this template
  // keeps the brand suffix consistent across every page.
  title: {
    default: "CodeShift AI - Instant SQL & Code Migration Tool",
    template: "%s | CodeShift AI"
  },
  description: "Migrate SQL queries and code dialects instantly using AI.",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
