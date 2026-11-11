import { describe, expect, it } from "vitest";
import { analyseIngredients } from "../src/engine/ingredient-engine.js";
describe("ingredient engine",()=>{
  it("detects added sugar",()=>expect(analyseIngredients("Hafer, Zucker, Glukosesirup").added_sugar).toBe(true));
  it("separates sweeteners",()=>expect(analyseIngredients("Milch, Sucralose").sweeteners_present).toBe(true));
  it("detects sweetening ingredients",()=>expect(analyseIngredients("Tomaten, Apfelsaftkonzentrat, Salz").sweetening_ingredients_present).toBe(true));
});
