import test from "node:test";
import assert from "node:assert/strict";
import { extractRossmannIngredients } from "../src/adapters/rossmann.js";

test("Rossmann: Allergene in <strong> ergeben keine Leerzeichen vor dem Komma", () => {
  assert.equal(extractRossmannIngredients("<h2>Zutaten</h2><div>Haferflocken, <strong>MANDELN</strong>, Datteln.</div><h2>Nährwerte</h2>"), "Haferflocken, MANDELN, Datteln.");
});

test("Rossmann: Spurenhinweis und Bio-Satz hinter der Liste gehören nicht dazu", () => {
  const html = "<h2>Zutaten</h2><div>Haferflocken, Datteln.</div><p>Kann Spuren von SESAM enthalten. Alle Zutaten sind aus kontrolliert biologischem Anbau</p><h2>Nährwerte</h2>";
  assert.equal(extractRossmannIngredients(html), "Haferflocken, Datteln.");
});

test("Rossmann: Meta-Beschreibung ist keine Zutatenliste", () => {
  assert.equal(extractRossmannIngredients('<meta name="description" content="Zutaten: Hinweise zur Zutaten">'), null);
});

test("Rossmann: JSON-Feld mit maskierten Anführungszeichen wird nicht abgeschnitten", () => {
  assert.equal(extractRossmannIngredients('{"ingredients":"Wasser, \\"Bio\\"-Hafer 20 %, Salz"}'), 'Wasser, "Bio"-Hafer 20 %, Salz');
});
