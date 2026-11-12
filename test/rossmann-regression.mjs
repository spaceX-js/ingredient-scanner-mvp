import { discoverRossmannProduct, extractRossmannIngredients } from "../src/adapters/rossmann.js";
import { analyseIngredients } from "../src/engine/ingredient-engine.js";

const ean = "4068134219077";
const rsc = `28:["$","div",null,{"children":[["$","ProductImage",null,{"product":{"ean":"4068134219077","dan":"227170","productUrl":"https://www.rossmann.de/de/lebensmittel-enerbio-haferriegel-lebkuchen-schoko/p/4068134219077","name":"Haferriegel Lebkuchen Schoko","brandName":"enerBiO","image":{"url":"https://example.test/img.png"}}}]]}]`;
const html = `<html><body><script>${rsc}</script><section><h2>Zutaten</h2><div>Haferflocken 45 %, Zucker, Sonnenblumenöl, Kakao</div><h2>Nährwerte</h2></section></body></html>`;
const ingredients = extractRossmannIngredients(html);
if (!ingredients || !ingredients.toLowerCase().includes("zucker")) throw new Error("Rossmann ingredient extraction regression failed");
const analysis = analyseIngredients(ingredients);
if (!analysis.added_sugar) throw new Error("Ingredient engine regression failed");
console.log("Rossmann parser regression OK", ean, ingredients);
console.log("Live discovery is intentionally tested after Cloudflare deployment via /api/product/" + ean);
