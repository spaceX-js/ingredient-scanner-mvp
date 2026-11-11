const ROSSMANN_BASE = "https://www.rossmann.de";

function slugify(value = "") {
  return String(value).toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss").replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/\\u003c/gi, "<").replace(/\\u003e/gi, ">")
    .replace(/\\u0026/gi, "&").replace(/\\"/g, '"')
    .replace(/&quot;/gi, '"').replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ").replace(/&#39;|&#x27;/gi, "'")
    .replace(/&auml;/gi, "ä").replace(/&ouml;/gi, "ö").replace(/&uuml;/gi, "ü")
    .replace(/&Auml;/g, "Ä").replace(/&Ouml;/g, "Ö").replace(/&Uuml;/g, "Ü").replace(/&szlig;/gi, "ß");
}

function cleanText(value = "") {
  return decodeHtml(value).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/\\n|\\r/g, " ").replace(/\s+/g, " ").trim();
}

export function extractRossmannIngredients(html = "") {
  const decoded = decodeHtml(html);
  const patterns = [
    /"(?:ingredients|ingredientText|ingredientsText)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,
    /(?:Zutaten|Inhaltsstoffe)[\s\S]{0,500}?((?:\d+(?:[.,]\d+)?\s*%\s*)?[A-Za-zÄÖÜäöüß][\s\S]{20,2500}?)(?=(?:Nährwert|Naehrwert|Allergen|Aufbewahrung|Verwendung|Hinweis|<\/section>|<\/article>))/i
  ];
  for (const re of patterns) {
    const match = decoded.match(re);
    if (!match?.[1]) continue;
    const text = cleanText(match[1]);
    if (text.length >= 10) return text;
  }
  return null;
}

function buildCandidates(ean, product = {}) {
  const brand = slugify(product.brand || product.brands || "");
  const name = slugify(product.name || product.product_name || "");
  const urls = new Set();
  if (brand && name) urls.add(`${ROSSMANN_BASE}/de/lebensmittel-${brand}-${name}/p/${ean}`);
  if (name) urls.add(`${ROSSMANN_BASE}/de/lebensmittel-${name}/p/${ean}`);
  return [...urls];
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "de-DE,de;q=0.9",
      "User-Agent": "Mozilla/5.0 (compatible; KlarZutaten/0.2; +https://workers.dev)"
    },
    redirect: "follow"
  });
  if (!response.ok) return null;
  return { html: await response.text(), finalUrl: response.url, status: response.status };
}

export async function getRossmannByProduct(ean, product = {}) {
  const candidates = buildCandidates(ean, product);
  if (!candidates.length) return { found: false, source: "Rossmann HTML", reason: "insufficient_product_metadata" };
  for (const url of candidates) {
    try {
      const page = await fetchPage(url);
      if (!page?.html || !page.html.includes(String(ean))) continue;
      const ingredients = extractRossmannIngredients(page.html);
      if (!ingredients) continue;
      return {
        found: true,
        source: "Rossmann HTML",
        source_url: page.finalUrl,
        confidence: "high",
        product: { ean, ingredients }
      };
    } catch (_) {}
  }
  return { found: false, source: "Rossmann HTML", reason: "no_verified_product_page_with_ingredients" };
}
