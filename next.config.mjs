/** @type {import('next').NextConfig} */
// Applied to every route. Cache-Control is deliberately NOT in here — it is
// set per-route below, because the app shell must never be cached while the
// static marketing pages should be cached hard.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // X-Frame-Options removed for preview (E2B uses iframe); CSP frame-ancestors controls embedding
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com https://*.e2b.app https://*.e2b.dev wss://*.e2b.app wss://*.e2b.dev; frame-src https://challenges.cloudflare.com; frame-ancestors 'self' https://*.e2b.app https://*.e2b.dev; base-uri 'self'; form-action 'self'"
  }
];
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["*.e2b.app", "*.e2b.dev"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      },
      {
        // The converter itself and the API must always be fresh, so the
        // remaining-uses count is never served from a cache.
        source: "/",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }]
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }]
      },
      {
        // Static guide pages: cache at the edge, revalidate in the background.
        source: "/convert/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800"
          }
        ]
      }
    ];
  }
};
export default nextConfig;
