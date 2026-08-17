const BASE = "https://code-migrator.nnamdimichael020.workers.dev";
export const dynamic = "force-static";
export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // No value in crawling the API endpoint.
        disallow: ["/api/"]
      }
    ],
    sitemap: `${BASE}/sitemap.xml`
  };
}
