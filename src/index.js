import { resolveProduct } from "./resolver.js";
import { APP_VERSION } from "./version.js";
import { isValidGtin } from "./gtin.js";
import { acceptHints } from "./hints.js";
import { submitIngredients, MAX_BODY } from "./submissions.js";

const json = (data, status = 200, cache = "public, max-age=300") =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache }
  });

export default {
  async fetch(request, env, ctx) {
    const u = new URL(request.url);
    if (u.pathname === "/api/health") return json({ status: "ok", service: "ingredient-scanner-mvp", version: APP_VERSION, d1: Boolean(env.DB) });
    if (u.pathname === "/api/version") return json({ version: APP_VERSION });

    const sub = u.pathname.match(/^\/api\/product\/(\d{8,14})\/ingredients$/);
    if (sub) {
      if (request.method !== "POST") return json({ error: "Method not allowed", version: APP_VERSION }, 405, "no-store");
      if (!isValidGtin(sub[1])) return json({ error: "Invalid GTIN/EAN (Länge oder Prüfziffer)", version: APP_VERSION }, 400, "no-store");
      // Nur von der eigenen Seite: fremde Ursprünge werden abgewiesen.
      const origin = request.headers.get("origin");
      if (origin && origin !== u.origin) return json({ error: "Forbidden", version: APP_VERSION }, 403, "no-store");
      const raw = await request.text();
      if (raw.length > MAX_BODY) return json({ error: "Anfrage zu groß", version: APP_VERSION }, 413, "no-store");
      let body; try { body = JSON.parse(raw); } catch { return json({ error: "Ungültiges JSON", version: APP_VERSION }, 400, "no-store"); }
      const r = await submitIngredients(env.DB, sub[1], body);
      return json(r.ok ? { ok: true, ean: sub[1], version: APP_VERSION } : { error: r.error, version: APP_VERSION }, r.status, "no-store");
    }

    const m = u.pathname.match(/^\/api\/product\/(\d{8,14})$/);
    if (m) {
      if (!isValidGtin(m[1])) return json({ error: "Invalid GTIN/EAN (Länge oder Prüfziffer)", version: APP_VERSION }, 400, "no-store");
      const { hints, ignored, trusted } = acceptHints(request, env, u);
      const data = await resolveProduct(m[1], hints, env, ctx);
      if (ignored) data.hints_ignored = true;
      // Antworten mit Admin-Hints nie cachen.
      return json(data, data.status === "NOT_FOUND" ? 404 : 200, trusted ? "no-store" : "public, max-age=300");
    }
    if (u.pathname.startsWith("/api/")) return json({ error: "Not found", version: APP_VERSION }, 404, "no-store");
    return env.ASSETS.fetch(request);
  }
};
