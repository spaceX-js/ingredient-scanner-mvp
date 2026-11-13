import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveProduct } from "../src/resolver.js";
import { createMergeResult, addCandidate } from "../src/field-merger.js";
import { indexCandidates, isFresh } from "../src/product-index.js";
import { FakeD1, stubFetch, jsonRes, htmlRes } from "./helpers/fake-d1.mjs";

const EAN = "4068134219077";
const DM_EAN = "4031244004895";
const PRODUCT_URL = `https://www.rossmann.de/de/lebensmittel-enerbio-haferriegel-lebkuchen-schoko/p/${EAN}`;
const searchRsc = fs.readFileSync(new URL("./fixtures/rossmann-search-rsc.txt", import.meta.url), "utf8");
const dmFixture = JSON.parse(fs.readFileSync(new URL("./fixtures/dm-product.json", import.meta.url), "utf8"));
const productPage = (ing) => `<html>${EAN}<h2>Zutaten</h2><div>${ing}</div><h2>Nährwerte</h2></html>`;
const off = (extra = {}) => ["openfoodfacts", () => jsonRes({ product: { product_name: "Haferriegel", brands: "enerBiO", ingredients_text_de: "Hafer, Zucker (OFF)", ...extra } })];
const rossmannRoutes = (ing = "Haferflocken 45 %, Zucker, Kakao") => [["/de/search", () => htmlRes(searchRsc)], [PRODUCT_URL, () => htmlRes(productPage(ing))]];
const dmRoutes = () => [["guided-search", () => jsonRes({ products: [{ gtin: DM_EAN, dan: 3118830 }] })], ["/detail/DE/dan/3118830", () => jsonRes(dmFixture)]];

test("Frische Händlerdaten werden gespeichert, OFF-only-Daten nicht", async () => {
  const db = new FakeD1(); const f = stubFetch([off(), ...rossmannRoutes()]);
  try {
    const r = await resolveProduct(EAN, {}, { DB: db, ENABLE_ROSSMANN: "1" });
    assert.equal(r.status, "ANALYSABLE");
    assert.equal(r.product.ingredients, "Haferflocken 45 %, Zucker, Kakao");
    const ing = db.fields.get(`${EAN}|ingredients`);
    assert.equal(ing.source, "Rossmann HTML"); assert.equal(ing.confidence, "verified");
    assert.ok([...db.fields.values()].every((x) => x.source !== "Open Food Facts"));
    assert.equal(db.retailers.find((x) => x.retailer === "rossmann").external_id, "227170");
    assert.equal(db.batches, 1, "alle Schreibzugriffe in genau einem Batch");
  } finally { f.restore(); }
});

test("Nur OFF-Daten: nichts wird in D1 geschrieben", async () => {
  const db = new FakeD1(); const f = stubFetch([off()]);
  try {
    const r = await resolveProduct(EAN, {}, { DB: db, ENABLE_ROSSMANN: "1" });
    assert.equal(r.product.ingredients, "Hafer, Zucker (OFF)");
    assert.equal(db.writes, 0);
  } finally { f.restore(); }
});

test("Zweiter Aufruf innerhalb der TTL: Cache-Treffer ohne Upstream-Abrufe", async () => {
  const db = new FakeD1(); let f = stubFetch([off(), ...rossmannRoutes()]);
  try { await resolveProduct(EAN, {}, { DB: db, ENABLE_ROSSMANN: "1" }); } finally { f.restore(); }
  f = stubFetch([]);
  try {
    const r = await resolveProduct(EAN, {}, { DB: db, ENABLE_ROSSMANN: "1" });
    assert.equal(f.calls.length, 0);
    assert.equal(r.index.cache, "hit");
    assert.equal(r.product.ingredients, "Haferflocken 45 %, Zucker, Kakao");
    assert.equal(r.fields.ingredients.cached, true);
  } finally { f.restore(); }
});

test("Nach Ablauf der TTL wird neu abgerufen und der Wert aktualisiert", async () => {
  const db = new FakeD1(); let f = stubFetch([off(), ...rossmannRoutes("Haferflocken, Kakao")]);
  try { await resolveProduct(EAN, {}, { DB: db, ENABLE_ROSSMANN: "1" }); } finally { f.restore(); }
  const key = `${EAN}|ingredients`; const old = new Date(Date.now() - 30 * 86400e3).toISOString();
  db.fields.set(key, { ...db.fields.get(key), verified_at: old });
  f = stubFetch([off(), ...rossmannRoutes("Haferflocken, Kakao, Honig")]);
  try {
    const r = await resolveProduct(EAN, {}, { DB: db, ENABLE_ROSSMANN: "1" });
    assert.equal(r.index.cache, "miss");
    assert.equal(r.product.ingredients, "Haferflocken, Kakao, Honig");
    assert.equal(r.fields.ingredients.cached, undefined);
    assert.ok(Date.parse(db.fields.get(key).verified_at) > Date.parse(old));
  } finally { f.restore(); }
});

test("Kein Confidence-Laundering: gespeicherter OFF-Wert (medium) schlägt frische Rossmann-Daten nicht", async () => {
  const db = new FakeD1();
  db.seedField(EAN, "ingredients", "Alter OFF-Wert, Zucker", { source: "Open Food Facts", confidence: "medium" });
  const f = stubFetch([off(), ...rossmannRoutes("Haferflocken, Kakao")]);
  try {
    const r = await resolveProduct(EAN, {}, { DB: db, ENABLE_ROSSMANN: "1" });
    assert.equal(r.product.ingredients, "Haferflocken, Kakao");
    assert.equal(r.fields.ingredients.source, "Rossmann HTML");
  } finally { f.restore(); }
});

test("Index-Kandidaten behalten Quelle und Confidence; frischer Wert gewinnt bei Gleichstand", () => {
  const index = { product: { ean: EAN }, retailers: [], fields: [{ field: "ingredients", value: "alt", source: "Open Food Facts", confidence: "medium", source_url: null, verified_at: "2026-01-01T00:00:00Z" }] };
  const [c] = indexCandidates(index, EAN);
  assert.equal(c.source, "Open Food Facts"); assert.equal(c.confidence, "medium");
  const r = createMergeResult(EAN);
  addCandidate(r, c);
  addCandidate(r, { found: true, source: "Open Food Facts", confidence: "medium", product: { ingredients: "neu" } });
  assert.equal(r.product.ingredients, "neu");
});

test("isFresh: nur geprüfte Händlerquelle innerhalb der TTL", () => {
  const row = (o) => ({ fields: [{ field: "ingredients", source: "dm", confidence: "verified", verified_at: new Date().toISOString(), ...o }] });
  assert.equal(isFresh(row({})), true);
  assert.equal(isFresh(row({ source: "Open Food Facts" })), false);
  assert.equal(isFresh(row({ confidence: "medium" })), false);
  assert.equal(isFresh(row({ verified_at: new Date(Date.now() - 10 * 86400e3).toISOString() })), false);
  assert.equal(isFresh({ error: "index_unavailable", fields: [] }), false);
  assert.equal(isFresh(null), false);
});

test("dm: EAN->DAN wird gelernt; danach nutzt der Resolver das Mapping statt der Suche", async () => {
  const db = new FakeD1(); let f = stubFetch([...dmRoutes()]);
  try {
    const r = await resolveProduct(DM_EAN, {}, { DB: db, ENABLE_ROSSMANN: "1" });
    assert.equal(r.product.dm_dan, "3118830");
    assert.equal(db.retailers.find((x) => x.retailer === "dm").external_id, "3118830");
  } finally { f.restore(); }
  const key = `${DM_EAN}|ingredients`; db.fields.set(key, { ...db.fields.get(key), verified_at: new Date(Date.now() - 30 * 86400e3).toISOString() });
  f = stubFetch([...dmRoutes()]);
  try {
    await resolveProduct(DM_EAN, {}, { DB: db, ENABLE_ROSSMANN: "1" });
    assert.ok(!f.calls.some((u) => u.includes("guided-search")), "Suche wird übersprungen");
    assert.ok(f.calls.some((u) => u.includes("/detail/DE/dan/3118830")));
  } finally { f.restore(); }
});

test("dm- und Rossmann-IDs überschreiben sich nicht gegenseitig", async () => {
  const f = stubFetch([...rossmannRoutes(), ["guided-search", () => jsonRes({ products: [{ gtin: EAN, dan: 3118830 }] })], ["/detail/DE/dan/3118830", () => jsonRes({ ...dmFixture, gtin: EAN })]]);
  try {
    const r = await resolveProduct(EAN, {}, { ENABLE_ROSSMANN: "1" });
    assert.equal(r.product.rossmann_dan, "227170"); assert.equal(r.product.dm_dan, "3118830");
    assert.match(r.product.rossmann_url, /rossmann\.de/); assert.match(r.product.dm_url || "x", /dm\.de|x/);
  } finally { f.restore(); }
});

test("Ohne DB (oder defektes Schema) bleibt der Lookup funktionsfähig", async () => {
  const f = stubFetch([off(), ...rossmannRoutes()]);
  try {
    assert.equal((await resolveProduct(EAN, {}, { ENABLE_ROSSMANN: "1" })).status, "ANALYSABLE");
    const broken = { prepare() { throw new Error("no such table: products"); } };
    const r = await resolveProduct(EAN, {}, { DB: broken, ENABLE_ROSSMANN: "1" });
    assert.equal(r.status, "ANALYSABLE");
    assert.ok(r.resolver_trace.some((t) => t.reason === "index_unavailable"));
  } finally { f.restore(); }
});

test("Rossmann ist standardmäßig aus (kein Abruf ohne ENABLE_ROSSMANN)", async () => {
  const hits = [];
  const f = stubFetch([["openfoodfacts", () => jsonRes({ status: 0 })], ["rossmann", () => { hits.push("rossmann"); return htmlRes(""); }], ["syndigo", () => { hits.push("syndigo"); return jsonRes({}); }]]);
  try { await resolveProduct(EAN, {}, {}); } finally { f.restore(); }
  assert.deepEqual(hits, []);
});
