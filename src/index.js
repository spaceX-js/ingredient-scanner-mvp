import { resolveProduct } from "./resolver.js";
import { APP_NAME, APP_VERSION } from "./version.js";

const json = (data, status = 200) => new Response(JSON.stringify(data, null, 2), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return json({ ok: true, service: "ingredient-scanner-mvp", app: APP_NAME, version: APP_VERSION });
    if (url.pathname === "/api/version") return json({ app: APP_NAME, version: APP_VERSION });

    const match = url.pathname.match(/^\/api\/product\/(\d{8,14})$/);
    if (match) {
      const ean = match[1];
      const data = await resolveProduct(ean, { dm_url: url.searchParams.get("dm_url") });
      return json(data, data.status === "NOT_FOUND" ? 404 : 200);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found", version: APP_VERSION }, 404);
    return env.ASSETS.fetch(request);
  }
};
