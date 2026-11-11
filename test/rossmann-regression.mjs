import assert from "node:assert/strict";
import { discoverRossmannUrlFromHtml, extractRossmannIngredients } from "../src/adapters/rossmann.js";
const ean="4068134219077";
const html=`<a href="/de/lebensmittel-enerbio-haferriegel-lebkuchen-schoko/p/${ean}">Produkt</a>`;
assert.equal(discoverRossmannUrlFromHtml(html,ean),`https://www.rossmann.de/de/lebensmittel-enerbio-haferriegel-lebkuchen-schoko/p/${ean}`);
const product=`<html>${ean}<section><h2>Zutaten</h2><div>Hafervollkornflocken, Reissirup, Zucker, Kakao</div><h2>Nährwerte</h2></section></html>`;
const ing=extractRossmannIngredients(product);
assert.ok(ing && ing.includes("Reissirup") && ing.includes("Zucker"));
console.log("Rossmann regression OK");
