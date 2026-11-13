import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { FakeD1, stubFetch, jsonRes } from "./helpers/fake-d1.mjs";
import { extractIngredientText, sanitizeIngredientText, normalizeOcrText } from "../public/ingredient-text.js";
import { resolveProduct } from "../src/resolver.js";

const EAN = "4068134219077";
const post = (path, body, headers = {}, env = {}) => worker.fetch(new Request("https://example.test" + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }), env, { waitUntil() {} });

test("OCR-Text: Zutaten ausschneiden, Silbentrennung, Spuren und Nährwerte abtrennen", () => {
  const raw = "Haferriegel\nZutaten: Hafervollkornflocken, Rei-\nssirup, Zucker (Rohrzucker),\nMeersalz. Kann Spuren von SOJA und MILCH enthalten.\nDurchschnittliche Nährwerte pro 100 g: Energie 1814 kJ";
  const r = extractIngredientText(raw);
  assert.equal(r.found, true);
  assert.equal(r.ingredients, "Hafervollkornflocken, Reissirup, Zucker (Rohrzucker), Meersalz");
  assert.match(r.traces, /^Kann Spuren von SOJA und MILCH/);
  assert.equal(normalizeOcrText("a ,  b ( c )"), "a, b (c)");
});
test("OCR-Text ohne Zutaten-Marke: found=false, Text bleibt als Kandidat", () => {
  const r = extractIngredientText("Wasser, Zucker, Salz");
  assert.equal(r.found, false); assert.equal(r.ingredients, "Wasser, Zucker, Salz");
});
test("Einreichungs-Prüfung", () => {
  assert.equal(sanitizeIngredientText("Wasser, Zucker").ok, true);
  assert.equal(sanitizeIngredientText("<script>alert(1)</script> Wasser, Zucker").text.includes("<"), false);
  assert.equal(sanitizeIngredientText("12345 6789 000").ok, false);
  assert.equal(sanitizeIngredientText("Wasser http://evil.example").ok, false);
  assert.equal(sanitizeIngredientText("x".repeat(3001)).ok, false);
  assert.equal(sanitizeIngredientText(5).ok, false);
});
test("POST speichert Nutzer-Zutaten (low), danach liefert der Resolver sie als 'uncertain' oder Zucker-Urteil", async () => {
  const db = new FakeD1(); const f = stubFetch([["openfoodfacts", () => jsonRes({ status: 0 })]]);
  try {
    const res = await post(`/api/product/${EAN}/ingredients`, { text: "Haferflocken, Zucker, Salz", name: "Testriegel" }, {}, { DB: db });
    assert.equal(res.status, 200);
    const row = db.fields.get(`${EAN}|ingredients`);
    assert.equal(row.source, "Nutzer-Foto"); assert.equal(row.confidence, "low");
    assert.equal(db.products.get(EAN).name, "Testriegel");
    const r = await resolveProduct(EAN, {}, { DB: db });
    assert.equal(r.status, "ANALYSABLE");
    assert.equal(r.assessment.verdict, "added_sugar"); assert.equal(r.assessment.quality, "low");
    assert.match(r.assessment.quality_reason, /Nutzer/);
    assert.equal(r.product.name, "Testriegel");
  } finally { f.restore(); }
});
test("Saubere Nutzer-Zutaten ohne Treffer ergeben 'uncertain', nie 'none_detected'", async () => {
  const db = new FakeD1(); const f = stubFetch([["openfoodfacts", () => jsonRes({ status: 0 })]]);
  try {
    await post(`/api/product/${EAN}/ingredients`, { text: "Haferflocken, Salz" }, {}, { DB: db });
    const r = await resolveProduct(EAN, {}, { DB: db });
    assert.equal(r.assessment.verdict, "uncertain");
  } finally { f.restore(); }
});
test("Geprüfte Daten werden nie überschrieben (409)", async () => {
  const db = new FakeD1(); db.seedField(EAN, "ingredients", "Hafer, Salz", { source: "dm", confidence: "verified" });
  const res = await post(`/api/product/${EAN}/ingredients`, { text: "Zucker, Zucker, Zucker" }, {}, { DB: db });
  assert.equal(res.status, 409); assert.equal(JSON.parse(db.fields.get(`${EAN}|ingredients`).value_json), "Hafer, Salz");
});
test("Eigene Nutzer-Einreichung darf korrigiert werden", async () => {
  const db = new FakeD1(); await post(`/api/product/${EAN}/ingredients`, { text: "Hafer, Zucker" }, {}, { DB: db });
  const res = await post(`/api/product/${EAN}/ingredients`, { text: "Hafer, Salz" }, {}, { DB: db });
  assert.equal(res.status, 200); assert.equal(JSON.parse(db.fields.get(`${EAN}|ingredients`).value_json), "Hafer, Salz");
});
test("Fremder Origin, ungültige EAN, falsche Methode, zu große Anfrage, kaputtes JSON", async () => {
  const db = new FakeD1();
  assert.equal((await post(`/api/product/${EAN}/ingredients`, { text: "Hafer, Salz" }, { origin: "https://evil.example" }, { DB: db })).status, 403);
  assert.equal((await post(`/api/product/4068134219078/ingredients`, { text: "Hafer, Salz" }, {}, { DB: db })).status, 400);
  assert.equal((await worker.fetch(new Request(`https://example.test/api/product/${EAN}/ingredients`), { DB: db }, {})).status, 405);
  assert.equal((await post(`/api/product/${EAN}/ingredients`, "x".repeat(30000), {}, { DB: db })).status, 413);
  assert.equal((await post(`/api/product/${EAN}/ingredients`, "{kaputt", {}, { DB: db })).status, 400);
  assert.equal(db.fields.size, 0);
});
