import test from "node:test";
import assert from "node:assert/strict";
import { extractSugar, sugarLevel } from "../src/sugar.js";
import { explain } from "../public/sugar-lexicon.js";
import { analyseIngredients } from "../src/engine/ingredient-engine.js";
import { resolveProduct } from "../src/resolver.js";
import { FakeD1, stubFetch, jsonRes } from "./helpers/fake-d1.mjs";

test("Ampel-Schwellen (FSA)", () => {
  assert.equal(sugarLevel(5), "low"); assert.equal(sugarLevel(5.1), "medium"); assert.equal(sugarLevel(22.5), "medium"); assert.equal(sugarLevel(22.6), "high"); assert.equal(sugarLevel(null), null);
});
test("dm-Tabelle: 'davon Zucker' mit Komma", () => {
  const s = extractSugar({ Brennwert: "228 kJ / 54 kcal", "davon Zucker": "2,9 g", Salz: "0,04 g" });
  assert.equal(s.grams_per_100g, 2.9); assert.equal(s.level, "low"); assert.equal(s.teaspoons_per_100g, 0.7);
});
test("Manuelle Tabelle mit Portion", () => {
  const s = extractSugar({ "davon Zucker": "28 g", Portion: "Riegel (20 g)", "davon Zucker pro Portion": "5,6 g" });
  assert.equal(s.grams_per_100g, 28); assert.equal(s.level, "high"); assert.equal(s.teaspoons_per_100g, 7);
  assert.equal(s.grams_per_serving, 5.6); assert.equal(s.teaspoons_per_serving, 1.4); assert.equal(s.serving, "Riegel (20 g)");
});
test("Open-Food-Facts-Objekt", () => {
  const s = extractSugar({ sugars_100g: 11.5, sugars_serving: 3.45, sugars_unit: "g" });
  assert.equal(s.grams_per_100g, 11.5); assert.equal(s.level, "medium"); assert.equal(s.grams_per_serving, 3.5);
  assert.equal(extractSugar({ sugars_100g: 1200, sugars_unit: "mg" }).grams_per_100g, 1.2);
});
test("Nichts erkannt: null, nie 0", () => {
  assert.equal(extractSugar(null), null); assert.equal(extractSugar({}), null); assert.equal(extractSugar({ Fett: "3 g" }), null);
  assert.equal(extractSugar({ "davon Zuckerarten": "x" }), null);
});
test("Lexikon kennt jeden Begriff, den die Engine findet", () => {
  const text = "Zucker, Rohrzucker, Rübenzucker, Zuckerrübensirup, Saccharose, Traubenzucker, Dextrose, Fruchtzucker, Fruktose, Glukose, Glukosesirup, Fruktosesirup, Glukose-Fruktose-Sirup, Invertzuckersirup, Karamellsirup, Malzzucker, Maltose, Kokosblütenzucker, Vollrohrzucker, Puderzucker, Acesulfam K, Sucralose, Aspartam, Saccharin, Steviolglykoside, Cyclamat, Erythrit, Xylit, Sorbit, Isomalt, Maltit, Mannit, Honig, Agavendicksaft, Ahornsirup, Dattelsirup, Dattelpaste, Apfeldicksaft, Apfelsaftkonzentrat, Fruchtsaftkonzentrat, Birnendicksaft, Reissirup";
  const a = analyseIngredients(text);
  const all = [...a.added_sugar_matches, ...a.sweetener_matches, ...a.sweetening_ingredient_matches];
  assert.ok(all.length > 35);
  const unknown = all.filter((l) => !explain(l).known);
  assert.deepEqual(unknown, ["Zuckerrübensirup"]); // läuft über den Sirup-Fallback, nicht über einen eigenen Eintrag
  assert.match(explain("Zuckerrübensirup").text, /Süßungssirup/);
  assert.match(explain("Kokosblütenzucker*").text, /zugesetzter Zucker/);
  assert.equal(explain("Irgendwas").known, false);
});
test("Resolver liefert sugar_amount aus dem Index (manuell gepflegte Nährwerte)", async () => {
  const db = new FakeD1(); const f = stubFetch([["openfoodfacts", () => jsonRes({ status: 0 })]]);
  try {
    db.seedField("4068134219077", "ingredients", "Hafer, Salz", { source: "Manuell gepflegt", confidence: "high" });
    db.seedField("4068134219077", "nutrition", { "davon Zucker": "28 g" }, { source: "Manuell gepflegt", confidence: "high" });
    const r = await resolveProduct("4068134219077", {}, { DB: db });
    assert.equal(r.sugar_amount.grams_per_100g, 28); assert.equal(r.sugar_amount.level, "high");
    const r2 = await resolveProduct("4031244004895", {}, { DB: new FakeD1() });
    assert.equal(r2.sugar_amount, null);
  } finally { f.restore(); }
});
