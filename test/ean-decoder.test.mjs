import test from "node:test";
import assert from "node:assert/strict";
import { decodeEan, isValidEan } from "../public/ean-decoder.js";

const L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const R = L.map((s) => [...s].map((c) => (c === "0" ? "1" : "0")).join(""));
const G = R.map((s) => [...s].reverse().join(""));
const PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];
function modules(code) {
  if (code.length === 13) { const p = PARITY[+code[0]]; let s = "101"; for (let i = 0; i < 6; i++) s += (p[i] === "L" ? L : G)[+code[i + 1]]; s += "01010"; for (let i = 7; i < 13; i++) s += R[+code[i]]; return s + "101"; }
  let s = "101"; for (let i = 0; i < 4; i++) s += L[+code[i]]; s += "01010"; for (let i = 4; i < 8; i++) s += R[+code[i]]; return s + "101";
}
// Erzeugt ein Graustufenbild: Barcode (modulePx Pixel pro Modul) mit Ruhezone, Unschärfe, Rauschen, Helligkeitsverlauf.
function render(code, { w = 640, h = 480, px = 3.4, blur = 1, noise = 12, shear = 0, rotate180 = false, gradient = 40, offset = 37 } = {}) {
  const bits = modules(code); const total = bits.length * px; const x0 = offset + (w - total - offset) / 3;
  const img = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xs = x - shear * (y - h / 2); const m = Math.floor((xs - x0) / px);
    let v = 215; if (m >= 0 && m < bits.length && y > h * 0.2 && y < h * 0.8) v = bits[m] === "1" ? 35 : 215;
    img[y * w + x] = v - (gradient * x) / w;
  }
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0; for (let k = -blur; k <= blur; k++) { const xx = Math.min(w - 1, Math.max(0, x + k)); s += img[y * w + xx]; n++; }
    out[y * w + x] = Math.max(0, Math.min(255, s / n + rnd() * noise));
  }
  if (rotate180) out.reverse();
  return { gray: out, w, h };
}

test("isValidEan prüft Prüfziffern", () => {
  assert.ok(isValidEan("4068134219077")); assert.ok(isValidEan("4031244004895")); assert.ok(!isValidEan("4068134219078"));
});
for (const code of ["4068134219077", "4031244004895", "4006381333931", "5000112637922", "0012345678905"]) {
  test(`EAN-13 ${code} wird erkannt (unscharf, verrauscht)`, () => {
    const { gray, w, h } = render(code); assert.equal(decodeEan(gray, w, h), code);
  });
}
test("EAN-8 wird erkannt", () => { const { gray, w, h } = render("73513537"); assert.equal(decodeEan(gray, w, h), "73513537"); });
test("Kopfüber (180°) wird erkannt", () => { const { gray, w, h } = render("4068134219077", { rotate180: true }); assert.equal(decodeEan(gray, w, h), "4068134219077"); });
test("Leicht gedreht (Scherung) wird erkannt", () => { const { gray, w, h } = render("4068134219077", { shear: 0.06 }); assert.equal(decodeEan(gray, w, h), "4068134219077"); });
test("Kleine und große Module", () => {
  for (const px of [3, 5, 7]) { const { gray, w, h } = render("4031244004895", { px, w: 1280, h: 720 }); assert.equal(decodeEan(gray, w, h), "4031244004895", "px=" + px); }
});
test("Leeres/rauschendes Bild liefert null, nie eine falsche EAN", () => {
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const w = 640, h = 480; const g = new Uint8Array(w * h).map(() => (rnd() * 255) | 0);
  assert.equal(decodeEan(g, w, h), null);
  assert.equal(decodeEan(new Uint8Array(w * h).fill(200), w, h), null);
});
