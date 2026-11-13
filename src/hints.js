// Test-Hints (?rossmann_url=, ?dm_dan=) sind ein Admin-Werkzeug. Öffentlich vertraut der Worker ihnen NICHT:
// ein fremder Hint würde sonst serverseitig abgerufen und das Ergebnis landete im D1-Index.
// Hints gelten nur mit gültigem Header `x-admin-token` (Secret ADMIN_TOKEN, nicht im Repo) und werden zusätzlich geprüft.
const ROSSMANN_HOSTS = ["www.rossmann.de"];

export function safeRossmannUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!ROSSMANN_HOSTS.includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function safeDmDan(value) {
  return /^\d{5,9}$/.test(String(value ?? "")) ? String(value) : null;
}

function constantTimeEqual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function acceptHints(request, env, url) {
  const requested = url.searchParams.has("rossmann_url") || url.searchParams.has("dm_dan");
  const token = env?.ADMIN_TOKEN;
  const given = request.headers.get("x-admin-token");
  if (!requested) return { hints: {}, ignored: false, trusted: false };
  if (!token || !given || !constantTimeEqual(token, given)) return { hints: {}, ignored: true, trusted: false };
  const hints = {};
  const rossmann = safeRossmannUrl(url.searchParams.get("rossmann_url"));
  if (rossmann) hints.rossmann_url = rossmann;
  const dan = safeDmDan(url.searchParams.get("dm_dan"));
  if (dan) hints.dm_dan = dan;
  return { hints, ignored: false, trusted: true };
}
