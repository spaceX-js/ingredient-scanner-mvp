// Legt die OCR-Dateien (Tesseract.js + deutsche Sprachdaten) nach public/ocr/, damit die Seite sie selbst ausliefert.
// Läuft automatisch vor "wrangler deploy" (wrangler.jsonc -> build.command). Schlägt etwas fehl, wird nur gewarnt:
// das Deployment darf nie daran scheitern, die Seite nutzt dann weiter das CDN.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modules = process.env.VENDOR_OCR_NODE_MODULES || path.join(root, "node_modules");
const target = process.env.VENDOR_OCR_TARGET || path.join(root, "public", "ocr");
const dataSource = process.env.VENDOR_OCR_TRAINEDDATA || "https://github.com/tesseract-ocr/tessdata_fast/raw/main/deu.traineddata";

async function loadTrainedData(src) {
  if (!/^https:\/\//.test(src)) return fs.readFileSync(src);
  const r = await fetch(src, { redirect: "follow" });
  if (!r.ok) throw new Error(`Sprachdaten: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 100000) throw new Error("Sprachdaten: Datei zu klein");
  return buf;
}

async function main() {
  if (fs.existsSync(path.join(target, "tesseract.min.js")) && fs.existsSync(path.join(target, "deu.traineddata.gz"))) {
    console.log("[vendor-ocr] public/ocr ist schon vorhanden, übersprungen.");
    return;
  }
  const dist = path.join(modules, "tesseract.js", "dist");
  const core = path.join(modules, "tesseract.js-core");
  const need = [path.join(dist, "tesseract.min.js"), path.join(dist, "worker.min.js")];
  for (const f of need) if (!fs.existsSync(f)) throw new Error("Nicht gefunden: " + f);
  const cores = fs.existsSync(core) ? fs.readdirSync(core).filter((n) => /^tesseract-core.*\.(js|wasm)$/.test(n)) : [];
  if (!cores.length) throw new Error("tesseract.js-core nicht gefunden");

  const data = await loadTrainedData(dataSource);
  // Erst in einen Temp-Ordner, am Ende umbenennen: nie ein halber Ordner (sonst bräche die Texterkennung).
  const tmp = target + ".tmp";
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  for (const f of need) fs.copyFileSync(f, path.join(tmp, path.basename(f)));
  for (const n of cores) fs.copyFileSync(path.join(core, n), path.join(tmp, n));
  fs.writeFileSync(path.join(tmp, "deu.traineddata.gz"), zlib.gzipSync(data));
  fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(tmp, target);
  console.log(`[vendor-ocr] fertig: ${cores.length + 3} Dateien in public/ocr`);
}

main().catch((e) => {
  try { fs.rmSync(target + ".tmp", { recursive: true, force: true }); } catch {}
  console.warn("[vendor-ocr] Übersprungen, die Seite nutzt das CDN:", e.message);
}).finally(() => process.exit(0));
