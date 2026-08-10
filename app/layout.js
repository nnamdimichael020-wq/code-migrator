import "./globals.css";

export const metadata = {
  title: "CodeShift AI - Instant SQL & Code Migration Tool",
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
