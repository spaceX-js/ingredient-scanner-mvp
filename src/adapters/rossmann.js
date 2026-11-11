const BASE = "https://www.rossmann.de";

function decodeHtml(s = "") {
  return s
    .replace(/\\u003c/gi, "<").replace(/\\u003e/gi, ">")
    .replace(/\\u0026/gi, "&").replace(/\\\"/g, '"')
    .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/&#x27;|&#39;/g, "'").replace(/&auml;/g, "ä").replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü").replace(/&szlig;/g, "ß");
}

function clean(value = "") {
  return decodeHtml(value).replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/\\n|\\r/g, " ").replace(/\s+/g, " ").trim();
}

export function extractRossmannIngredients(html = "") {
  const text = decodeHtml(html);
  const structured = [
    /"(?:ingredients|ingredientText|ingredientsText|zutaten)"\s*:\s*"([\s\S]{10,4000}?)"\s*[,}]/i,
    /"name"\s*:\s*"Zutaten"[\s\S]{0,500}?"(?:value|text|description)"\s*:\s*"([\s\S]{10,4000}?)"/i
  ];
  for (const re of structured) {
    const m = text.match(re); if (m?.[1]) { const v = clean(m[1]); if (v.length >= 10) return v; }
  }
  const marker = /(?:>\s*Zutaten\s*<|"Zutaten"|Zutaten\s*:)/ig;
  let m;
  while ((m = marker.exec(text))) {
    const window = text.slice(m.index, m.index + 6000);
    const stops = ["Nährwerte", "Nährwert", "Allergene", "Aufbewahrung", "Verwendung", "Hinweise"];
    let end = window.length;
    for (const stop of stops) { const i = window.indexOf(stop, 20); if (i > 0) end = Math.min(end, i); }
    const candidate = clean(window.slice(m[0].length, end)).replace(/^[:\s-]+/, "");
    if (candidate.length >= 20 && candidate.length <= 3500) return candidate;
  }
  return null;
}

function absoluteRossmannUrl(href) {
  const decoded = decodeHtml(href).replace(/\\\//g, "/");
  if (decoded.startsWith("https://www.rossmann.de/")) return decoded;
  if (decoded.startsWith("/")) return BASE + decoded;
  return null;
}

export function discoverRossmannUrlFromHtml(html = "", ean) {
  const escaped = String(ean).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`(?:href=|\\\"url\\\"\\s*:\\s*)[\\\"']([^\\\"']*\\/p\\/${escaped}(?:[?#][^\\\"']*)?)[\\\"']`, "i"),
    new RegExp(`(https?:\\/\\/www\\.rossmann\\.de\\/de\\/[^\\\"'<>\\s]+\\/p\\/${escaped})`, "i"),
    new RegExp(`(\\/de\\/[^\\\"'<>\\s]+\\/p\\/${escaped})`, "i")
  ];
  for (const re of patterns) {
    const m = decodeHtml(html).match(re); if (m?.[1]) return absoluteRossmannUrl(m[1]);
  }
  return null;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "Accept": "text/html,application/xhtml+xml", "Accept-Language": "de-DE,de;q=0.9", "User-Agent": "Mozilla/5.0 (compatible; KlarZutaten/0.2.1)" },
    redirect: "follow"
  });
  if (!res.ok) return { ok: false, status: res.status, url: res.url || url, html: "" };
  return { ok: true, status: res.status, url: res.url || url, html: await res.text() };
}

export async function discoverRossmannProductUrl(ean) {
  const q = encodeURIComponent(ean);
  const candidates = [
    `${BASE}/de/search?q=${q}`,
    `${BASE}/de/suche?q=${q}`,
    `${BASE}/de/search?text=${q}`,
    `${BASE}/de/search/?q=${q}`
  ];
  const trace = [];
  for (const url of candidates) {
    try {
      const page = await fetchHtml(url); trace.push({ url, http_status: page.status });
      if (!page.ok) continue;
      const found = discoverRossmannUrlFromHtml(page.html, ean);
      if (found) return { found: true, url: found, trace };
      if (page.url && page.url.includes(`/p/${ean}`)) return { found: true, url: page.url, trace };
    } catch (error) { trace.push({ url, error: String(error?.message || error) }); }
  }
  return { found: false, trace };
}

export async function getRossmannByEan(ean) {
  const discovery = await discoverRossmannProductUrl(ean);
  if (!discovery.found) return { found: false, source: "Rossmann HTML", reason: "ean_discovery_failed", trace: discovery.trace };
  try {
    const page = await fetchHtml(discovery.url);
    if (!page.ok) return { found: false, source: "Rossmann HTML", reason: "product_fetch_failed", http_status: page.status, trace: discovery.trace };
    if (!page.html.includes(String(ean))) return { found: false, source: "Rossmann HTML", reason: "ean_not_verified", source_url: page.url, trace: discovery.trace };
    const ingredients = extractRossmannIngredients(page.html);
    const title = clean((page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/\s*\|\s*ROSSMANN.*$/i, "");
    return {
      found: true, source: "Rossmann HTML", source_url: page.url, confidence: ingredients ? "high" : "medium",
      product: { ean, name: title || null, ingredients: ingredients || null }, trace: discovery.trace
    };
  } catch (error) {
    return { found: false, source: "Rossmann HTML", reason: String(error?.message || error), trace: discovery.trace };
  }
}
