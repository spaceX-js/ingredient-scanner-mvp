import test from "node:test";
import assert from "node:assert/strict";
import { extractRossmannIngredients } from "../src/adapters/rossmann.js";

test("extracts ingredients from Rossmann-like HTML", () => {
  const html = '<section><h2>Zutaten</h2><div>Haferflocken, Zucker, Kakao</div><h2>Nährwerte</h2></section>';
  const ingredients = extractRossmannIngredients(html);
  assert.match(ingredients || "", /Haferflocken/);
  assert.match(ingredients || "", /Zucker/);
});
