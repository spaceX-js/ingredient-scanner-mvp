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

async function fetchText(url, { accept = "text/html,application/xhtml+xml", rsc = false } = {}) {
  const headers = {
    "Accept": accept,
    "Accept-Language": "de-DE,de;q=0.9",
    "User-Agent": "Mozilla/5.0 (compatible; KlarZutaten/0.2.4)"
  };
  if (rsc) {
    headers.RSC = "1";
    headers["Next-Router-Prefetch"] = "1";
  }
  const res = await fetch(url, { headers, redirect: "follow" });
  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    url: res.url || url,
    text,
    contentType: res.headers.get("content-type") || "",
    bytes: text.length
  };
}

function productFromRsc(text, ean) {
  const decoded = decodeHtml(text);
  const eanEsc = String(ean).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const urlMatch = decoded.match(new RegExp(`"productUrl"\\s*:\\s*"([^\"]*\\/p\\/${eanEsc})"`, "i"));
  if (!urlMatch) return null;
  const around = decoded.slice(Math.max(0, urlMatch.index - 1600), Math.min(decoded.length, urlMatch.index + 3000));
  const name = (around.match(/"name"\s*:\s*"([^\"]+)"/i) || [])[1] || null;
  const brandName = (around.match(/"brandName"\s*:\s*"([^\"]+)"/i) || [])[1] || null;
  const dan = (around.match(/"dan"\s*:\s*"([^\"]+)"/i) || [])[1] || null;
  const image = (around.match(/"image"\s*:\s*\{[^}]*"url"\s*:\s*"([^\"]+)"/i) || [])[1] || null;
  return { ean: String(ean), productUrl: urlMatch[1], name, brandName, dan, image: image ? { url: image } : null };
}

function normalizeProduct(obj, ean) {
  const url = obj.productUrl;
  return {
    ean: String(ean),
    name: obj.name || null,
    brand: obj.brandName || null,
    dan: obj.dan || null,
    image: obj.image?.url || null,
    productUrl: url?.startsWith("http") ? url : url ? BASE + url : null
  };
}

function diag(mode, response, parserStage, productFound = false) {
  return {
    step: "rossmann_discovery",
    mode,
    http_status: response?.status ?? null,
    content_type: response?.contentType || null,
    response_bytes: response?.bytes ?? 0,
    parser_stage: parserStage,
    product_found: productFound
  };
}

export async function discoverRossmannProduct(ean) {
  const trace = [];
  const searchUrl = `${BASE}/de/search?text=${encodeURIComponent(ean)}`;

  // 1) Normal HTML. Some deployments embed the Flight payload directly.
  try {
    const html = await fetchText(searchUrl);
    const product = html.ok ? productFromRsc(html.text, ean) : null;
    trace.push(diag("html", html, product ? "product_url_found" : "product_url_missing", Boolean(product)));
    if (product) return { found: true, product: normalizeProduct(product, ean), trace, discovery: "html" };
  } catch (error) {
    trace.push({ step: "rossmann_discovery", mode: "html", parser_stage: "fetch_error", error: String(error?.message || error) });
  }

  // 2) Next.js React Server Component / Flight representation.
  // _rsc is intentionally not hard-coded; the server can return Flight data based on headers.
  try {
    const rsc = await fetchText(searchUrl, { accept: "text/x-component,*/*;q=0.9", rsc: true });
    const product = rsc.ok ? productFromRsc(rsc.text, ean) : null;
    trace.push(diag("rsc", rsc, product ? "product_url_found" : "product_url_missing", Boolean(product)));
    if (product) return { found: true, product: normalizeProduct(product, ean), trace, discovery: "rsc" };
  } catch (error) {
    trace.push({ step: "rossmann_discovery", mode: "rsc", parser_stage: "fetch_error", error: String(error?.message || error) });
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
    const pageTrace = {
      step: "rossmann_product_page",
      http_status: page.status,
      content_type: page.contentType,
      response_bytes: page.bytes,
      ean_present: page.text.includes(String(ean))
    };
    if (!page.ok) return { found: false, source: "Rossmann HTML", reason: "product_page_error", http_status: page.status, trace: [...discovery.trace, pageTrace] };
    if (!pageTrace.ean_present) return { found: false, source: "Rossmann HTML", reason: "ean_mismatch", source_url: page.url, trace: [...discovery.trace, pageTrace] };
    const ingredients = extractRossmannIngredients(page.text);
    pageTrace.ingredients_found = Boolean(ingredients);
    return {
      found: true,
      source: "Rossmann HTML",
      source_url: page.url,
      confidence: ingredients ? "high" : "medium",
      reason: ingredients ? null : "ingredients_missing",
      product: { ean, name: p.name, brand: p.brand, dan: p.dan, image: p.image, ingredients: ingredients || null },
      trace: [...discovery.trace, pageTrace]
    };
  } catch (error) {
    return { found: false, source: "Rossmann HTML", reason: "product_page_error", trace: discovery.trace, error: String(error?.message || error) };
  }
}
