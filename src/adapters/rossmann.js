// Rossmann does not expose a universal public product URL from the EAN alone.
// This adapter is deliberately conservative: it can parse a known Rossmann URL,
// while EAN -> URL discovery will be added once we have a stable catalogue endpoint.
function decodeHtml(s = "") {
  return s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&auml;/g, "ä").replace(/&ouml;/g, "ö").replace(/&uuml;/g, "ü").replace(/&szlig;/g, "ß");
}

export function extractRossmannIngredients(html) {
  const candidates = [
    /(?:Zutaten|Inhaltsstoffe)[^<]{0,80}<[^>]*>([\s\S]{20,2500}?)<\/[^>]+>/i,
    /"(?:ingredients|zutaten)"\s*:\s*"([\s\S]{20,2500}?)"/i,
    /Zutaten[^:]{0,50}:\s*([^<]{20,2500})/i
  ];
  for (const re of candidates) {
    const m = html.match(re);
    if (m) return decodeHtml(m[1].replace(/<[^>]+>/g, " ").replace(/\\u003c[^>]*>/g, " ").replace(/\\n/g, " ").replace(/\s+/g, " ").trim());
  }
  return null;
}

export async function getRossmannByUrl(ean, productUrl) {
  if (!productUrl) return { found: false, source: "Rossmann HTML", reason: "product_url_required" };
  try {
    const res = await fetch(productUrl, { headers: { "Accept-Language": "de-DE,de;q=0.9" } });
    if (!res.ok) return { found: false, source: "Rossmann HTML", http_status: res.status };
    const html = await res.text();
    const ingredients = extractRossmannIngredients(html);
    return { found: true, source: "Rossmann HTML", source_url: productUrl, confidence: ingredients ? "high" : "low", product: { ean, ingredients } };
  } catch (error) {
    return { found: false, source: "Rossmann HTML", reason: String(error) };
  }
}
