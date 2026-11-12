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
    const m = text.match(re);
    if (m?.[1]) { const v = clean(m[1]); if (v.length >= 10) return v; }
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

async function fetchText(url, accept = "text/html,application/xhtml+xml") {
  const res = await fetch(url, {
    headers: {
      "Accept": accept,
      "Accept-Language": "de-DE,de;q=0.9",
      "User-Agent": "Mozilla/5.0 (compatible; KlarZutaten/0.2.3)"
    },
    redirect: "follow"
  });
  return { ok: res.ok, status: res.status, url: res.url || url, text: res.ok ? await res.text() : "", contentType: res.headers.get("content-type") || "" };
}

function walk(value, visit) {
  if (value == null) return;
  if (Array.isArray(value)) { for (const item of value) walk(item, visit); return; }
  if (typeof value === "object") { visit(value); for (const item of Object.values(value)) walk(item, visit); }
}

function exactProductFromJson(data, ean) {
  let match = null;
  walk(data, obj => {
    if (match) return;
    const candidateEan = String(obj.ean ?? obj.id ?? obj.gtin ?? obj.code ?? "");
    const url = obj.productUrl ?? obj.url ?? obj.product_url ?? null;
    if (candidateEan === String(ean) && url && String(url).includes(`/p/${ean}`)) match = obj;
  });
  return match;
}

function productFromRsc(text, ean) {
  const decoded = decodeHtml(text);
  const eanEsc = String(ean).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const urlMatch = decoded.match(new RegExp(`"productUrl"\\s*:\\s*"([^"]*\\/p\\/${eanEsc})"`, "i"));
  if (!urlMatch) return null;
  const around = decoded.slice(Math.max(0, urlMatch.index - 1200), Math.min(decoded.length, urlMatch.index + 2500));
  const name = (around.match(/"name"\s*:\s*"([^"]+)"/i) || [])[1] || null;
  const brandName = (around.match(/"brandName"\s*:\s*"([^"]+)"/i) || [])[1] || null;
  const dan = (around.match(/"dan"\s*:\s*"([^"]+)"/i) || [])[1] || null;
  const image = (around.match(/"image"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/i) || [])[1] || null;
  return { ean: String(ean), productUrl: urlMatch[1], name, brandName, dan, image: image ? { url: image } : null };
}

function normalizeSearchProduct(obj, ean) {
  const url = obj.productUrl ?? obj.url ?? obj.product_url;
  return {
    ean: String(ean),
    name: obj.name ?? obj.productName ?? null,
    brand: obj.brandName ?? obj.brand ?? null,
    dan: obj.dan ?? obj.articleNumber ?? null,
    image: obj.image?.url ?? obj.imageUrl ?? null,
    productUrl: url?.startsWith("http") ? url : url ? BASE + url : null
  };
}

export async function discoverRossmannProduct(ean) {
  const trace = [];
  const query = `pageIndex=0&text=${encodeURIComponent(ean)}&showRetailMedia=true&pageSize=24`;
  const apiCandidates = [
    `${BASE}/de/search.ws/v3/search/products/by-text?${query}`,
    `${BASE}/search.ws/v3/search/products/by-text?${query}`
  ];

  for (const url of apiCandidates) {
    try {
      const res = await fetchText(url, "application/json,text/plain,*/*");
      trace.push({ step: "search_api", url, http_status: res.status, content_type: res.contentType });
      if (!res.ok || !res.text) continue;
      try {
        const data = JSON.parse(res.text);
        const product = exactProductFromJson(data, ean);
        if (product) return { found: true, product: normalizeSearchProduct(product, ean), trace, discovery: "search_api" };
      } catch {
        const product = productFromRsc(res.text, ean);
        if (product) return { found: true, product: normalizeSearchProduct(product, ean), trace, discovery: "search_api_text" };
      }
    } catch (error) {
      trace.push({ step: "search_api", url, error: String(error?.message || error) });
    }
  }

  // Fallback: the public search page may itself expose the product in its RSC payload.
  const searchUrl = `${BASE}/de/search?text=${encodeURIComponent(ean)}`;
  try {
    const page = await fetchText(searchUrl);
    trace.push({ step: "search_page", url: searchUrl, http_status: page.status });
    if (page.ok) {
      const product = productFromRsc(page.text, ean);
      if (product) return { found: true, product: normalizeSearchProduct(product, ean), trace, discovery: "search_page_rsc" };
    }
  } catch (error) {
    trace.push({ step: "search_page", url: searchUrl, error: String(error?.message || error) });
  }

  return { found: false, reason: "product_link_missing", trace };
}

export async function getRossmannByEan(ean) {
  const discovery = await discoverRossmannProduct(ean);
  if (!discovery.found) return { found: false, source: "Rossmann HTML", reason: discovery.reason, trace: discovery.trace };
  const p = discovery.product;
  if (!p.productUrl) return { found: false, source: "Rossmann HTML", reason: "product_link_missing", trace: discovery.trace };

  try {
    const page = await fetchText(p.productUrl);
    if (!page.ok) return { found: false, source: "Rossmann HTML", reason: "product_page_error", http_status: page.status, trace: discovery.trace };
    if (!page.text.includes(String(ean))) return { found: false, source: "Rossmann HTML", reason: "ean_mismatch", source_url: page.url, trace: discovery.trace };
    const ingredients = extractRossmannIngredients(page.text);
    return {
      found: true,
      source: "Rossmann HTML",
      source_url: page.url,
      confidence: ingredients ? "high" : "medium",
      reason: ingredients ? null : "ingredients_missing",
      product: { ean, name: p.name, brand: p.brand, dan: p.dan, image: p.image, ingredients: ingredients || null },
      trace: [...discovery.trace, { step: "product_page", url: page.url, http_status: page.status, ingredients_found: Boolean(ingredients) }]
    };
  } catch (error) {
    return { found: false, source: "Rossmann HTML", reason: "product_page_error", trace: discovery.trace, error: String(error?.message || error) };
  }
}
