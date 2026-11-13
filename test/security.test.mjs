import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import worker from "../src/index.js";
import { isValidGtin } from "../src/gtin.js";
import { acceptHints, safeRossmannUrl, safeDmDan } from "../src/hints.js";
import { stubFetch, jsonRes, htmlRes } from "./helpers/fake-d1.mjs";

const EAN = "4068134219077";
const DM_EAN = "4031244004895";
const dmFixture = JSON.parse(fs.readFileSync(new URL("./fixtures/dm-product.json", import.meta.url), "utf8"));
const req = (path, headers = {}) => new Request("https://example.test" + path, { headers });
const call = async (path, env = {}, headers = {}) => { const res = await worker.fetch(req(path, headers), env, { waitUntil() {} }); return { res, body: await res.json() }; };

test("GTIN-Prüfziffer", () => {
  assert.ok(isValidGtin(EAN)); assert.ok(isValidGtin(DM_EAN)); assert.ok(isValidGtin("40170725"));
  assert.ok(!isValidGtin("4068134219078")); assert.ok(!isValidGtin("12345678901")); assert.ok(!isValidGtin("abc")); assert.ok(!isValidGtin(""));
});

test("Ungültige EAN: 400 ohne Upstream-Abruf", async () => {
  const f = stubFetch([]);
  try {
    const { res } = await call("/api/product/4068134219078");
    assert.equal(res.status, 400); assert.equal(f.calls.length, 0);
  } finally { f.restore(); }
});

test("Hints ohne Admin-Token werden ignoriert und nie abgerufen", async () => {
  const f = stubFetch([["openfoodfacts", () => jsonRes({ product: { product_name: "X" } })]]);
  try {
    const { body, res } = await call(`/api/product/${EAN}?rossmann_url=${encodeURIComponent("https://evil.example/boese")}&dm_dan=1234567`, { ADMIN_TOKEN: "geheim" });
    assert.equal(body.hints_ignored, true);
    assert.ok(!f.calls.some((u) => u.includes("evil.example")));
    assert.ok(!f.calls.some((u) => u.includes("/detail/DE/dan/1234567")));
    assert.match(res.headers.get("cache-control"), /max-age/);
  } finally { f.restore(); }
});

test("Falsches Token wird wie kein Token behandelt; ohne gesetztes Secret sind Hints aus", () => {
  const url = new URL("https://x.test/api/product/1?dm_dan=1234567");
  assert.equal(acceptHints(req("/", { "x-admin-token": "falsch" }), { ADMIN_TOKEN: "richtig" }, url).ignored, true);
  assert.equal(acceptHints(req("/", { "x-admin-token": "irgendwas" }), {}, url).ignored, true);
  assert.deepEqual(acceptHints(req("/", { "x-admin-token": "richtig" }), { ADMIN_TOKEN: "richtig" }, url).hints, { dm_dan: "1234567" });
});

test("Mit Token: nur Rossmann-Host und 5-9-stellige DAN; Antwort wird nicht gecacht", async () => {
  assert.ok(safeRossmannUrl("https://www.rossmann.de/de/x/p/" + EAN));
  for (const bad of ["http://www.rossmann.de/x", "https://evil.example/x", "https://www.rossmann.de.evil.example/x", "https://u:p@www.rossmann.de/x", "https://www.rossmann.de:8443/x"]) assert.equal(safeRossmannUrl(bad), null, bad);
  assert.equal(safeDmDan("3118830"), "3118830"); assert.equal(safeDmDan("../x"), null); assert.equal(safeDmDan("12"), null);

  const f = stubFetch([["openfoodfacts", () => jsonRes({ product: { product_name: "X" } })]]);
  try {
    const { res, body } = await call(`/api/product/${EAN}?rossmann_url=${encodeURIComponent("https://evil.example/x")}`, { ADMIN_TOKEN: "t" }, { "x-admin-token": "t" });
    assert.ok(!f.calls.some((u) => u.includes("evil.example")));
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(body.hints_ignored, undefined);
  } finally { f.restore(); }
});

test("dm_dan eines anderen Produkts wird nicht unter dieser EAN übernommen (EAN-Abgleich)", async () => {
  const f = stubFetch([["openfoodfacts", () => jsonRes({ product: { product_name: "Haferriegel" } })], ["/detail/DE/dan/3118830", () => jsonRes(dmFixture)]]);
  try {
    const { body } = await call(`/api/product/${EAN}?dm_dan=3118830`, { ADMIN_TOKEN: "t" }, { "x-admin-token": "t" });
    assert.equal(body.product.dm_dan, undefined);
    assert.ok(body.resolver_trace.some((t) => t.source === "dm" && t.reason === "ean_mismatch"));
    assert.ok(!/Karotten/.test(body.product.ingredients || ""));
  } finally { f.restore(); }
});

test("Rossmann-URL-Hint mit fremder EAN auf der Seite wird abgelehnt", async () => {
  const f = stubFetch([["openfoodfacts", () => jsonRes({ product: { product_name: "X" } })], ["www.rossmann.de/de/x/p/" + EAN, () => htmlRes("<h2>Zutaten</h2><div>Fremde Seite, Zucker</div><h2>Nährwerte</h2>")]]);
  try {
    const { body } = await call(`/api/product/${EAN}?rossmann_url=${encodeURIComponent("https://www.rossmann.de/de/x/p/" + EAN)}`, { ADMIN_TOKEN: "t" }, { "x-admin-token": "t" });
    assert.ok(body.resolver_trace.some((t) => t.reason === "ean_mismatch"));
    assert.ok(!/Fremde Seite/.test(body.product.ingredients || ""));
  } finally { f.restore(); }
});
