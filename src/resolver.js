import { getOpenFoodFacts } from "./adapters/openfoodfacts.js";
import { getRossmannByEan, getRossmannByUrl } from "./adapters/rossmann.js";
import { getRossmannSyndigo } from "./adapters/syndigo.js";
import { getDmByEan, getDmByDan } from "./adapters/dm.js";
import { analyseIngredients } from "./engine/ingredient-engine.js";
import { createMergeResult, addCandidate, publicFields } from "./field-merger.js";
import { getIndexedProduct, hintsFromIndex, indexCandidate, persistResolvedProduct } from "./product-index.js";
import { APP_VERSION } from "./version.js";

export async function resolveProduct(ean, hints={}, env={}){
  const r=createMergeResult(ean);
  const index=await getIndexedProduct(env.DB,ean);
  const indexedHints=hintsFromIndex(index);
  const effective={...indexedHints,...hints};
  const cached=indexCandidate(index,ean); if(cached)addCandidate(r,cached);
  if(index?.error) r.resolver_trace.push({source:"KlarZutaten Index",found:false,reason:index.error});
  else if(index) r.resolver_trace.push({source:"KlarZutaten Index",found:true,reason:"mapping_found",retailer_mappings:index.retailers?.length||0});
  else r.resolver_trace.push({source:"KlarZutaten Index",found:false,reason:env.DB?"mapping_missing":"db_unbound"});

  // General source remains useful for unknown products and field completion.
  addCandidate(r,await getOpenFoodFacts(ean));

  // Known retailer mappings skip fragile discovery and go straight to retailer details.
  if(effective.rossmann_url) addCandidate(r,await getRossmannByUrl(ean,effective.rossmann_url,{dan:effective.rossmann_dan||null}));
  else addCandidate(r,await getRossmannByEan(ean));
  addCandidate(r,await getRossmannSyndigo(ean));
  addCandidate(r,effective.dm_dan?await getDmByDan(effective.dm_dan):await getDmByEan(ean));

  const p=r.product;
  const known=Boolean(p.name||p.brand||p.productUrl||p.ingredients||effective.dm_dan||effective.rossmann_url);
  const status=!known?"NOT_FOUND":p.ingredients?"ANALYSABLE":"MISSING_INGREDIENTS";
  const analysis=analyseIngredients(p.ingredients||"");
  if(p.withoutAddedSugar===true&&!analysis.added_sugar&&analysis.confidence!=="none") analysis.validation={without_added_sugar_claim:true,consistent:true};
  const out={version:APP_VERSION,ean,product:p,fields:publicFields(r.fields),sources:r.sources,resolver_trace:r.resolver_trace,status,analysis,index:{enabled:Boolean(env.DB),mapping_found:Boolean(index&&!index.error)}};
  await persistResolvedProduct(env.DB,out);
  return out;
}
