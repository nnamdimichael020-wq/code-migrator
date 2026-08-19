// Minimal Cloudflare KV client for server-side routes.
//
// Reuses the same dashboard-API pattern as the usage counter in
// /api/convert (CF_ACCOUNT_ID + CF_KV_NAMESPACE_ID + CF_API_TOKEN),
// so reviews and rate limits need no new Cloudflare setup.

export function kvConfig() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const namespaceId = process.env.CF_KV_NAMESPACE_ID;
  const token = process.env.CF_API_TOKEN;
  if (!accountId || !namespaceId || !token) return null;
  return { accountId, namespaceId, token };
}

function kvUrl(config, key) {
  return `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/${encodeURIComponent(key)}`;
}

export async function kvGet(config, key) {
  const res = await fetch(kvUrl(config, key), {
    headers: { Authorization: `Bearer ${config.token}` }
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV read failed (${res.status}): ${text.slice(0, 160)}`);
  }
  return res.text();
}

export async function kvPut(config, key, value, expirationTtl) {
  const url = new URL(kvUrl(config, key));
  if (expirationTtl) url.searchParams.set("expiration_ttl", String(expirationTtl));
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "text/plain"
    },
    body: value
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV write failed (${res.status}): ${text.slice(0, 160)}`);
  }
}
