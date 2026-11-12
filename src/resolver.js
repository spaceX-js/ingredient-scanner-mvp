import { getOpenFoodFacts } from "./adapters/openfoodfacts.js";
import { getRossmannByEan } from "./adapters/rossmann.js";
import { getRossmannSyndigo } from "./adapters/syndigo.js";
import { getDmByUrl } from "./adapters/dm.js";
import { analyseIngredients } from "./engine/ingredient-engine.js";
import { APP_VERSION } from "./version.js";

function merge(base, candidate) {
  base.resolver_trace.push({ source: candidate?.source || "unknown", found: Boolean(candidate?.found), confidence: candidate?.confidence || null, reason: candidate?.reason || null });
  if (Array.isArray(candidate?.trace)) {
    for (const detail of candidate.trace) base.resolver_trace.push({ source: candidate?.source || "unknown", ...detail });
  }
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
  const result = { version: APP_VERSION, ean, product: { ean }, fields: {}, sources: [], resolver_trace: [] };
  merge(result, await getOpenFoodFacts(ean));

  // Rossmann discovery is EAN-based and does not depend on OFF finding the product.
  if (!result.product.ingredients) merge(result, await getRossmannByEan(ean));
  if (!result.product.ingredients) merge(result, await getRossmannSyndigo(ean));
  if (!result.product.ingredients && hints.dm_url) merge(result, await getDmByUrl(ean, hints.dm_url));

  result.status = !result.product.name && !result.product.ingredients ? "NOT_FOUND" : result.product.ingredients ? "ANALYSABLE" : "MISSING_INGREDIENTS";
  result.analysis = analyseIngredients(result.product.ingredients || "");
  return result;
}
