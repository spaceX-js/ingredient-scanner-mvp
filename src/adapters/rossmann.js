function decodeHtml(s = "") {
  return s
    .replace(/\\u003c/gi, "<").replace(/\\u003e/gi, ">").replace(/\\u0026/gi, "&")
    .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/&#x27;|&#39;/g, "'").replace(/&auml;/g, "ä").replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü").replace(/&szlig;/g, "ß");
}

function cleanText(s = "") {
  return decodeHtml(s)
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\n|\\r|\\t/g, " ")
    .replace(/\\\"/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(s = "") {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss").replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function extractRossmannIngredients(html) {
  // Rossmann embeds product details in the document response. Depending on the
  // current frontend version, HTML can be literal or JSON-escaped (\\u003c...).
  const decoded = decodeHtml(html);
  const candidates = [
    /["'](?:ingredients|ingredientText|ingredientsText|zutaten)["']\s*:\s*["']([\s\S]{15,5000}?)["']\s*[,}]/i,
    /(?:Zutaten|Inhaltsstoffe)[\s\S]{0,1200}?<p[^>]*>([\s\S]{15,5000}?)<\/p>/i,
    /(?:Zutaten|Inhaltsstoffe)[\s\S]{0,1200}?>([^<>]{15,5000}?)<\/[^>]+>/i,
    /(?:Zutaten|Inhaltsstoffe)[^:]{0,80}:\s*([^<]{15,5000})/i
  ];
  for (const re of candidates) {
    const m = decoded.match(re);
    if (m) {
      const value = cleanText(m[1]);
      if (value.length >= 15 && !/^(nährwerte|gesetzliche gewährleistung)$/i.test(value)) return value;
    }
  }
  return null;
}

export function buildRossmannCandidateUrls(ean, product = {}) {
  const brand = slugify((product.brand || "").split(",")[0]);
  let name = slugify(product.name || "");
  // OFF names sometimes already repeat the brand.
  if (brand && name.startsWith(brand + "-")) name = name.slice(brand.length + 1);
  const core = [brand, name].filter(Boolean).join("-");
  if (!core) return [];

  // Food is our MVP focus. Keep a few common Rossmann top-level prefixes so the
  // adapter remains useful for baby food and health-food products as well.
  const prefixes = ["lebensmittel", "baby-und-spielzeug", "gesundheit"];
  return [...new Set(prefixes.map(prefix => `https://www.rossmann.de/de/${prefix}-${core}/p/${ean}`))];
}

async function fetchRossmannPage(ean, url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; KlarZutaten-MVP/0.2; +https://github.com/spaceX-js/ingredient-scanner-mvp)",
      "Accept-Language": "de-DE,de;q=0.9",
      "Accept": "text/html,application/xhtml+xml"
    }
  });
  if (!res.ok) return null;
  const html = await res.text();
  // Never accept a generic/home/error page as a product match.
  if (!html.includes(ean)) return null;
  const ingredients = extractRossmannIngredients(html);
  return {
    found: true,
    source: "Rossmann HTML",
    source_url: res.url || url,
    confidence: ingredients ? "high" : "low",
    product: { ean, ingredients }
  };
}

export async function getRossmannByUrl(ean, productUrl) {
  if (!productUrl) return { found: false, source: "Rossmann HTML", reason: "product_url_required" };
  try {
    return (await fetchRossmannPage(ean, productUrl)) || { found: false, source: "Rossmann HTML", reason: "page_not_matched" };
  } catch (error) {
    return { found: false, source: "Rossmann HTML", reason: String(error) };
  }
}

export async function getRossmannByProduct(ean, product = {}) {
  const urls = buildRossmannCandidateUrls(ean, product);
  if (!urls.length) return { found: false, source: "Rossmann HTML", reason: "insufficient_product_metadata" };
  let lastReason = "no_candidate_matched";
  for (const url of urls) {
    try {
      const hit = await fetchRossmannPage(ean, url);
      if (hit) return hit;
    } catch (error) {
      lastReason = String(error);
    }
  }
  return { found: false, source: "Rossmann HTML", reason: lastReason, attempted_urls: urls };
}
