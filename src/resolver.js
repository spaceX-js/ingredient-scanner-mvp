import { getOpenFoodFactsProduct } from "./adapters/openfoodfacts.js";
import { getRossmannByProduct } from "./adapters/rossmann.js";
import { analyzeIngredients } from "./engine/ingredient-engine.js";

function hasIngredients(product) {
  return Boolean(
    product?.ingredients_text &&
    String(product.ingredients_text).trim().length > 0
  );
}

function normalizeProduct(ean, product = {}) {
  return {
    ean,
    product_name: product.product_name || "",
    brands: product.brands || "",
    quantity: product.quantity || "",
    image_url:
      product.image_front_url ||
      product.image_url ||
      "",
    ingredients_text: product.ingredients_text || "",
    nutriments: product.nutriments || {},
    allergens: product.allergens || "",
    source: product.source || "Open Food Facts",
    confidence: product.confidence || "medium",
    source_url: product.source_url || null
  };
}

export async function resolveProduct(ean) {
  // 1. Open Food Facts bleibt unsere primäre Produktquelle.
  const offResult = await getOpenFoodFactsProduct(ean);

  if (!offResult?.found || !offResult?.product) {
    return {
      status: "NOT_FOUND",
      ean,
      product: null,
      analysis: null,
      sources: []
    };
  }

  let product = normalizeProduct(ean, offResult.product);

  const sources = [
    {
      source: offResult.source || "Open Food Facts",
      confidence: offResult.confidence || "medium",
      fields: [
        "product_name",
        "brands",
        "quantity",
        "image_url",
        ...(hasIngredients(product) ? ["ingredients_text"] : [])
      ]
    }
  ];

  // 2. Wenn OFF bereits Zutaten liefert, direkt analysieren.
  if (hasIngredients(product)) {
    return {
      status: "ANALYSABLE",
      ean,
      product,
      analysis: analyzeIngredients(product.ingredients_text),
      sources
    };
  }

  // 3. Zutaten fehlen:
  //    Rossmann serverseitig als Händler-Fallback versuchen.
  const rossmannResult = await getRossmannByProduct(ean, product);

  if (
    rossmannResult?.found &&
    rossmannResult?.ingredients_text
  ) {
    product = {
      ...product,
      ingredients_text: rossmannResult.ingredients_text,
      source: rossmannResult.source,
      confidence: rossmannResult.confidence,
      source_url: rossmannResult.url || null
    };

    sources.push({
      source: rossmannResult.source,
      confidence: rossmannResult.confidence,
      fields: ["ingredients_text"],
      url: rossmannResult.url || null
    });

    return {
      status: "ANALYSABLE",
      ean,
      product,
      analysis: analyzeIngredients(product.ingredients_text),
      sources
    };
  }

  // 4. Produkt wurde gefunden, aber wir haben weiterhin
  //    keine auswertbare Zutatenliste.
  return {
    status: "MISSING_INGREDIENTS",
    ean,
    product,
    analysis: null,
    sources
  };
}
