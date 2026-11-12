import { getOpenFoodFacts } from "./adapters/openfoodfacts.js";
import { getRossmannByEan } from "./adapters/rossmann.js";
import { getRossmannSyndigo } from "./adapters/syndigo.js";
import { getDmByEan, getDmByDan } from "./adapters/dm.js";
import { analyseIngredients } from "./engine/ingredient-engine.js";
import { createMergeResult, addCandidate, publicFields } from "./field-merger.js";
import { APP_VERSION } from "./version.js";
export async function resolveProduct(ean,hints={}){
  const r=createMergeResult(ean);
  // Independent sources: no source is skipped just because OFF already has ingredients.
  addCandidate(r,await getOpenFoodFacts(ean));
  addCandidate(r,await getRossmannByEan(ean));
  addCandidate(r,await getRossmannSyndigo(ean));
  addCandidate(r,hints.dm_dan?await getDmByDan(hints.dm_dan):await getDmByEan(ean));
  const p=r.product;
  const known=Boolean(p.name||p.brand||p.productUrl||p.ingredients);
  const status=!known?"NOT_FOUND":p.ingredients?"ANALYSABLE":"MISSING_INGREDIENTS";
  const analysis=analyseIngredients(p.ingredients||"");
  if(p.withoutAddedSugar===true&&!analysis.added_sugar&&analysis.confidence!=="none") analysis.validation={without_added_sugar_claim:true,consistent:true};
  return {version:APP_VERSION,ean,product:p,fields:publicFields(r.fields),sources:r.sources,resolver_trace:r.resolver_trace,status,analysis};
}
