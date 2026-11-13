import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";

const script = new URL("../scripts/vendor-ocr.mjs", import.meta.url).pathname;
const run = (env) => spawnSync(process.execPath, [script], { env: { ...process.env, ...env }, encoding: "utf8" });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "vendor-ocr-"));

function fakeModules(dir) {
  const dist = path.join(dir, "tesseract.js", "dist"); const core = path.join(dir, "tesseract.js-core");
  fs.mkdirSync(dist, { recursive: true }); fs.mkdirSync(core, { recursive: true });
  fs.writeFileSync(path.join(dist, "tesseract.min.js"), "//t"); fs.writeFileSync(path.join(dist, "worker.min.js"), "//w");
  for (const n of ["tesseract-core.wasm.js", "tesseract-core-simd.wasm", "other.txt"]) fs.writeFileSync(path.join(core, n), "x");
}

test("Skript legt alle Dateien atomar nach public/ocr und komprimiert die Sprachdaten", () => {
  const base = tmp(); const mods = path.join(base, "nm"); fakeModules(mods);
  const data = path.join(base, "deu.traineddata"); fs.writeFileSync(data, Buffer.alloc(200000, 7));
  const target = path.join(base, "public", "ocr");
  const r = run({ VENDOR_OCR_NODE_MODULES: mods, VENDOR_OCR_TARGET: target, VENDOR_OCR_TRAINEDDATA: data });
  assert.equal(r.status, 0);
  assert.deepEqual(fs.readdirSync(target).sort(), ["deu.traineddata.gz", "tesseract-core-simd.wasm", "tesseract-core.wasm.js", "tesseract.min.js", "worker.min.js"]);
  assert.equal(zlib.gunzipSync(fs.readFileSync(path.join(target, "deu.traineddata.gz"))).length, 200000);
  assert.ok(!fs.existsSync(target + ".tmp"));
  assert.match(run({ VENDOR_OCR_NODE_MODULES: mods, VENDOR_OCR_TARGET: target, VENDOR_OCR_TRAINEDDATA: data }).stdout, /übersprungen/);
});

test("Fehlende Pakete: Exit 0, kein halber Ordner (Deploy darf nie scheitern)", () => {
  const base = tmp(); const target = path.join(base, "public", "ocr");
  const r = run({ VENDOR_OCR_NODE_MODULES: path.join(base, "leer"), VENDOR_OCR_TARGET: target });
  assert.equal(r.status, 0); assert.ok(!fs.existsSync(target)); assert.match(r.stderr + r.stdout, /CDN/);
});

test("Fehlende Sprachdaten: Exit 0 und nichts angelegt", () => {
  const base = tmp(); const mods = path.join(base, "nm"); fakeModules(mods); const target = path.join(base, "public", "ocr");
  const r = run({ VENDOR_OCR_NODE_MODULES: mods, VENDOR_OCR_TARGET: target, VENDOR_OCR_TRAINEDDATA: path.join(base, "gibtsnicht") });
  assert.equal(r.status, 0); assert.ok(!fs.existsSync(target)); assert.ok(!fs.existsSync(target + ".tmp"));
});
