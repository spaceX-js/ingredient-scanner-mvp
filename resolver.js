import { getOpenFoodFacts } from "./adapters/openfoodfacts.js";
import { getRossmannSyndigo } from "./adapters/syndigo.js";
import { getRossmannByUrl, getRossmannByProduct } from "./adapters/rossmann.js";
import { getDmByUrl } from "./adapters/dm.js";
import { analyseIngredients } from "./engine/ingredient-engine.js";

function merge(base, candidate) {
  if (!candidate?.found) return base;
  const p = candidate.product || {};
  for (const [key, value] of Object.entries(p)) {
    if (value != null && value !== "" && (base.product[key] == null || base.product[key] === "")) {
      base.product[key] = value;
      base.fields[key] = { source: candidate.source, source_url: candidate.source_url || null, confidence: candidate.confidence || "medium" };
    }
  }
  base.sources.push({ source: candidate.source, source_url: candidate.source_url || null, confidence: candidate.confidence || null });
  return base;
}

export async function resolveProduct(ean, hints = {}) {
  const result = { ean, product: { ean }, fields: {}, sources: [] };
  const off = await getOpenFoodFacts(ean);
  merge(result, off);

  // Explicit URL remains useful for debugging, but normal production requests no
  // longer require it. Rossmann discovery derives candidate URLs from OFF metadata.
  if (!result.product.ingredients && hints.rossmann_url) {
    merge(result, await getRossmannByUrl(ean, hints.rossmann_url));
  }
  if (!result.product.ingredients && result.product.name) {
    merge(result, await getRossmannByProduct(ean, result.product));
  }
  if (!result.product.ingredients) merge(result, await getRossmannSyndigo(ean));
  if (!result.product.ingredients && hints.dm_url) merge(result, await getDmByUrl(ean, hints.dm_url));

  result.status = !result.product.name && !result.product.ingredients
    ? "NOT_FOUND"
    : result.product.ingredients ? "ANALYSABLE" : "MISSING_INGREDIENTS";
  result.analysis = analyseIngredients(result.product.ingredients || "");
  return result;
}
