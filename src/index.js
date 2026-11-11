import { resolveProduct } from "./resolver.js";
import { APP_VERSION } from "./version.js";

const json = (data, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return json({ status: "ok", service: "ingredient-scanner-mvp", version: APP_VERSION });
    if (url.pathname === "/api/version") return json({ version: APP_VERSION });
    const match = url.pathname.match(/^\/api\/product\/(\d{8,14})$/);
    if (match) {
      const data = await resolveProduct(match[1], { dm_url: url.searchParams.get("dm_url") });
      return json(data, data.status === "NOT_FOUND" ? 404 : 200);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found", version: APP_VERSION }, 404);
    return env.ASSETS.fetch(request);
  }
};
