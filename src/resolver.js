import { getOpenFoodFacts } from "./adapters/openfoodfacts.js";
import { getRossmannByProduct } from "./adapters/rossmann.js";
import { getRossmannSyndigo } from "./adapters/syndigo.js";
import { getDmByUrl } from "./adapters/dm.js";
import { analyseIngredients } from "./engine/ingredient-engine.js";
import { APP_VERSION } from "./version.js";

function merge(base, candidate) {
  if (!candidate?.found) return base;
  const p = candidate.product || {};
  for (const [key, value] of Object.entries(p)) {
    if (value != null && value !== "" && (base.product[key] == null || base.product[key] === "")) {
      base.product[key] = value;
      base.fields[key] = {
        source: candidate.source,
        source_url: candidate.source_url || null,
        confidence: candidate.confidence || "medium"
      };
    }
  }
  base.sources.push({
    source: candidate.source,
    source_url: candidate.source_url || null,
    confidence: candidate.confidence || null
  });
  return base;
}

export async function resolveProduct(ean, hints = {}) {
  const result = { version: APP_VERSION, ean, product: { ean }, fields: {}, sources: [], resolver_trace: [] };

  const off = await getOpenFoodFacts(ean);
  result.resolver_trace.push({ source: "Open Food Facts", found: Boolean(off?.found) });
  merge(result, off);

  if (!result.product.ingredients && (result.product.name || result.product.brand)) {
    const rossmann = await getRossmannByProduct(ean, result.product);
    result.resolver_trace.push({ source: "Rossmann HTML", found: Boolean(rossmann?.found), reason: rossmann?.reason || null });
    merge(result, rossmann);
  }

  if (!result.product.ingredients) {
    const syndigo = await getRossmannSyndigo(ean);
    result.resolver_trace.push({ source: "Rossmann/Syndigo", found: Boolean(syndigo?.found), confidence: syndigo?.confidence || null });
    merge(result, syndigo);
  }

  if (!result.product.ingredients && hints.dm_url) {
    const dm = await getDmByUrl(ean, hints.dm_url);
    result.resolver_trace.push({ source: "dm", found: Boolean(dm?.found) });
    merge(result, dm);
  }

  result.status = !result.product.name && !result.product.ingredients
    ? "NOT_FOUND"
    : result.product.ingredients ? "ANALYSABLE" : "MISSING_INGREDIENTS";
  result.analysis = analyseIngredients(result.product.ingredients || "");
  return result;
}
