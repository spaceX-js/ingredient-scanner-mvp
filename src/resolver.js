import { getOpenFoodFacts } from "./adapters/openfoodfacts.js";
import { getRossmannByEan, getRossmannByUrl } from "./adapters/rossmann.js";
import { getRossmannSyndigo } from "./adapters/syndigo.js";
import { getDmByEan, getDmByDan } from "./adapters/dm.js";
import { analyseIngredients } from "./engine/ingredient-engine.js";
import { createMergeResult, addCandidate, publicFields, confidenceRank } from "./field-merger.js";
import { getIndexedProduct, hintsFromIndex, indexCandidates, isFresh, persistResolvedProduct } from "./product-index.js";
import { APP_VERSION } from "./version.js";

const DEFAULT_TTL_HOURS = 168; // 7 Tage

export async function resolveProduct(ean, hints = {}, env = {}, ctx = null) {
  const r = createMergeResult(ean);
  const index = await getIndexedProduct(env.DB, ean);
  const effective = { ...hintsFromIndex(index), ...hints };
  for (const c of indexCandidates(index, ean)) addCandidate(r, c);

  const ttlHours = Number(env.CACHE_TTL_HOURS) > 0 ? Number(env.CACHE_TTL_HOURS) : DEFAULT_TTL_HOURS;
  const fresh = isFresh(index, { ttlHours });
  if (index?.error) r.resolver_trace.push({ source: "KlarZutaten Index", found: false, reason: index.error });
  else if (index) r.resolver_trace.push({ source: "KlarZutaten Index", found: true, reason: fresh ? "fresh_hit_upstream_skipped" : "mapping_or_stale", retailer_mappings: index.retailers?.length || 0 });
  else r.resolver_trace.push({ source: "KlarZutaten Index", found: false, reason: env.DB ? "mapping_missing" : "db_unbound" });

  if (!fresh) {
    // Unabhängige Quellen parallel: kürzere Antwortzeit bei gleicher Anzahl Abrufe.
    const [off, rossmann, dm] = await Promise.all([
      getOpenFoodFacts(ean),
      effective.rossmann_url ? getRossmannByUrl(ean, effective.rossmann_url, { dan: effective.rossmann_dan || null }) : getRossmannByEan(ean),
      effective.dm_dan ? getDmByDan(effective.dm_dan, ean) : getDmByEan(ean)
    ]);
    addCandidate(r, off);
    addCandidate(r, rossmann);
    addCandidate(r, dm);
    // Syndigo ist nur Enhanced Content (niedrige Confidence): nur fragen, wenn nichts Besseres da ist.
    if (confidenceRank(r.fields.ingredients?.confidence) < confidenceRank("high")) addCandidate(r, await getRossmannSyndigo(ean));
  }

  const p = r.product;
  const known = Boolean(p.name || p.brand || p.ingredients || p.rossmann_url || p.dm_url || effective.dm_dan || effective.rossmann_url);
  const status = !known ? "NOT_FOUND" : p.ingredients ? "ANALYSABLE" : "MISSING_INGREDIENTS";
  const analysis = analyseIngredients(p.ingredients || "");
  if (p.withoutAddedSugar === true && !analysis.added_sugar && analysis.confidence !== "none") analysis.validation = { without_added_sugar_claim: true, consistent: true };
  const out = {
    version: APP_VERSION, ean, product: p, fields: publicFields(r.fields), sources: r.sources, resolver_trace: r.resolver_trace, status, analysis,
    index: { enabled: Boolean(env.DB), mapping_found: Boolean(index && !index.error), cache: fresh ? "hit" : "miss" }
  };

  // Schreiben ist vom Antwortpfad entkoppelt, wenn der Runtime-Kontext es erlaubt.
  const save = persistResolvedProduct(env.DB, { ean, product: p, fields: r.fields, mappings: r.mappings });
  if (ctx?.waitUntil) ctx.waitUntil(save); else await save;
  return out;
}
