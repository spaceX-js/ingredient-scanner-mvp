import test from "node:test";
import assert from "node:assert/strict";
import { analyseIngredients } from "../src/engine/ingredient-engine.js";

test("recognises added sugar and sweetener", () => {
  const r = analyseIngredients("Milch, Zucker, Acesulfam K");
  assert.equal(r.added_sugar, true);
  assert.equal(r.sweeteners_present, true);
});

test("recognises apple juice concentrate as sweetening ingredient", () => {
  const r = analyseIngredients("Tomatenmark, Apfelsaftkonzentrat, Sonnenblumenöl");
  assert.equal(r.sweetening_ingredients_present, true);
});
