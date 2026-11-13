import test from "node:test";
import assert from "node:assert/strict";
import { assess } from "../src/assessment.js";
import { analyseIngredients } from "../src/engine/ingredient-engine.js";

const HIGH = { source: "dm", confidence: "verified" };
const OFF = { source: "Open Food Facts", confidence: "medium" };
const LOW = { source: "Rossmann/Syndigo", confidence: "low" };

test("Ohne Zutaten nie 'nichts gefunden': Urteil unknown", () => {
  const a = analyseIngredients("");
  assert.equal(assess(a, null, false).verdict, "unknown");
});
test("Zucker gefunden schlägt alles, auch bei niedriger Datenlage", () => {
  const a = analyseIngredients("Wasser, Zucker");
  assert.equal(assess(a, LOW, true).verdict, "added_sugar");
});
test("Nichts gefunden: bei hoch/mittel none_detected, bei niedrig uncertain", () => {
  const a = analyseIngredients("Haferflocken, Salz");
  assert.equal(assess(a, HIGH, true).verdict, "none_detected");
  assert.equal(assess(a, OFF, true).verdict, "none_detected");
  assert.equal(assess(a, LOW, true).verdict, "uncertain");
});
test("Qualitätsstufen", () => {
  const a = analyseIngredients("Salz");
  assert.equal(assess(a, HIGH, true).quality, "high");
  assert.equal(assess(a, OFF, true).quality, "medium");
  assert.equal(assess(a, LOW, true).quality, "low");
});
test("Süßungsmittel und süßende Zutaten", () => {
  assert.equal(assess(analyseIngredients("Wasser, Sucralose"), HIGH, true).verdict, "sweeteners");
  assert.equal(assess(analyseIngredients("Hafer, Reissirup"), HIGH, true).verdict, "sweetening_ingredients");
});
test("Zusammensetzungen auf -zucker werden als zugesetzter Zucker erkannt", () => {
  const a = analyseIngredients("Kakaomasse, Kokosblütenzucker*, Vollrohrzucker, zuckerfrei");
  assert.ok(a.added_sugar_matches.includes("Kokosblütenzucker"));
  assert.ok(a.added_sugar_matches.includes("Vollrohrzucker"));
  assert.equal(a.added_sugar, true);
});
