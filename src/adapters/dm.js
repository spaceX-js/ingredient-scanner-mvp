// dm pages contain rich product data, but EAN -> current product URL discovery
// still needs a stable endpoint. Parser support is kept separate from discovery.
export function extractDmIngredients(html) {
  const patterns = [
    /"ingredients"\s*:\s*"([\s\S]{20,3000}?)"/i,
    /Zutaten[^:]{0,80}:\s*([^<]{20,3000})/i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1].replace(/\\n/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return null;
}

export async function getDmByUrl(ean, productUrl) {
  if (!productUrl) return { found: false, source: "dm", reason: "product_url_required" };
  try {
    const res = await fetch(productUrl, { headers: { "Accept-Language": "de-DE,de;q=0.9" } });
    if (!res.ok) return { found: false, source: "dm", http_status: res.status };
    const html = await res.text();
    const ingredients = extractDmIngredients(html);
    return { found: true, source: "dm", source_url: productUrl, confidence: ingredients ? "high" : "low", product: { ean, ingredients } };
  } catch (error) {
    return { found: false, source: "dm", reason: String(error) };
  }
}
