const ENDPOINTS = [
  (ean) => `https://world.openfoodfacts.org/api/v2/product/${ean}.json`,
  (ean) => `https://de.openfoodfacts.org/api/v2/product/${ean}.json`,
  (ean) => `https://world.openfoodfacts.org/api/v0/product/${ean}.json`
];

export async function getOpenFoodFacts(ean) {
  for (const buildUrl of ENDPOINTS) {
    const url = buildUrl(ean);
    try {
      const res = await fetch(url, { headers: { "User-Agent": "KlarZutaten-MVP/0.1" } });
      if (!res.ok) continue;
      const json = await res.json();
      const p = json.product;
      if (!p) continue;
      return {
        found: true,
        source: "Open Food Facts",
        source_url: url,
        confidence: "medium",
        product: {
          ean,
          name: p.product_name_de || p.product_name || null,
          brand: p.brands || null,
          ingredients: p.ingredients_text_de || p.ingredients_text || null,
          nutrition: p.nutriments || null,
          image: p.image_front_url || p.image_url || null
        }
      };
    } catch (_) {}
  }
  return { found: false, source: "Open Food Facts" };
}
