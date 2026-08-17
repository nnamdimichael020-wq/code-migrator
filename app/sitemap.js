import { PAIRS } from "../lib/pairs";
const BASE = "https://code-migrator.nnamdimichael020.workers.dev";
export const dynamic = "force-static";
export default function sitemap() {
  const now = new Date();
  return [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/convert`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...PAIRS.map((pair) => ({
      url: `${BASE}/convert/${pair.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8
    }))
  ];
}
