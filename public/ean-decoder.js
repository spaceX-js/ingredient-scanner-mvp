// Eigener EAN-13/EAN-8-Decoder (UPC-A wird als EAN-13 mit führender 0 geliefert). Keine Abhängigkeiten.
// Eingabe: Graustufen-Bild (Uint8Array, width*height). Ausgabe: Ziffernstring oder null.
const L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const R = L.map((s) => [...s].map((c) => (c === "0" ? "1" : "0")).join(""));
const G = R.map((s) => [...s].reverse().join(""));
const PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

const runsOf = (bits) => { const out = []; let n = 1; for (let i = 1; i <= bits.length; i++) { if (bits[i] === bits[i - 1]) n++; else { out.push(n); n = 1; } } return out; };
const PAT = (set) => set.map(runsOf);
const PL = PAT(L), PG = PAT(G), PR = PAT(R);

export function isValidEan(code) {
  if (!/^(\d{8}|\d{13})$/.test(code)) return false;
  const d = [...code].map(Number); const check = d.pop(); let sum = 0;
  d.reverse().forEach((x, i) => { sum += x * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === check;
}

function otsu(vals) {
  const hist = new Array(256).fill(0); for (const v of vals) hist[v]++;
  const total = vals.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF; const v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; thr = t; } }
  return { thr, best };
}

function rowRuns(line) {
  // leichte Glättung gegen Rauschen
  const sm = new Uint8Array(line.length);
  for (let i = 0; i < line.length; i++) sm[i] = ((line[Math.max(0, i - 1)] + line[i] * 2 + line[Math.min(line.length - 1, i + 1)]) / 4) | 0;
  const { thr, best } = otsu(sm);
  if (best < 1e7) return null; // zu wenig Kontrast
  const runs = []; let cur = sm[0] < thr, n = 1;
  for (let i = 1; i < sm.length; i++) { const dark = sm[i] < thr; if (dark === cur) n++; else { runs.push({ dark: cur, w: n }); cur = dark; n = 1; } }
  runs.push({ dark: cur, w: n });
  return runs;
}

function digitFrom(w4, sets) {
  const T = w4[0] + w4[1] + w4[2] + w4[3];
  const norm = w4.map((x) => (x * 7) / T);
  let best = -1, bestSet = null, bestErr = 1e9, second = 1e9;
  for (const [name, pats] of sets) for (let d = 0; d < 10; d++) {
    let err = 0; for (let k = 0; k < 4; k++) err += (norm[k] - pats[d][k]) ** 2;
    if (err < bestErr) { second = bestErr; bestErr = err; best = d; bestSet = name; } else if (err < second) second = err;
  }
  if (bestErr > 1.2) return null;
  return { d: best, set: bestSet };
}

function decodeRuns(runs, start, kind) {
  const half = kind === 13 ? 6 : 4;
  const need = 3 + half * 4 + 5 + half * 4 + 3;
  if (start + need > runs.length) return null;
  const w = (i) => runs[start + i].w;
  const guard = (w(0) + w(1) + w(2)) / 3;
  for (let i = 0; i < 3; i++) if (w(i) < guard * 0.5 || w(i) > guard * 1.7) return null;
  let p = 3; const left = [], leftSets = [];
  const lsets = kind === 13 ? [["L", PL], ["G", PG]] : [["L", PL]];
  for (let k = 0; k < half; k++) { const r = digitFrom([w(p), w(p + 1), w(p + 2), w(p + 3)], lsets); if (!r) return null; left.push(r.d); leftSets.push(r.set); p += 4; }
  for (let i = 0; i < 5; i++) if (w(p + i) < guard * 0.5 || w(p + i) > guard * 1.7) return null; // Mittelmuster
  p += 5;
  const right = [];
  for (let k = 0; k < half; k++) { const r = digitFrom([w(p), w(p + 1), w(p + 2), w(p + 3)], [["R", PR]]); if (!r) return null; right.push(r.d); p += 4; }
  for (let i = 0; i < 3; i++) if (w(p + i) < guard * 0.5 || w(p + i) > guard * 1.7) return null; // Endmuster
  let code;
  if (kind === 13) { const pi = PARITY.indexOf(leftSets.join("")); if (pi < 0) return null; code = String(pi) + left.join("") + right.join(""); }
  else code = left.join("") + right.join("");
  return isValidEan(code) ? code : null;
}

function decodeLine(line) {
  for (const arr of [line, [...line].reverse()]) {
    const runs = rowRuns(arr instanceof Uint8Array ? arr : Uint8Array.from(arr));
    if (!runs) continue;
    for (let i = 0; i < runs.length - 3; i++) {
      if (!runs[i].dark) continue;
      const g = (runs[i].w + runs[i + 1].w + runs[i + 2].w) / 3;
      if (i > 0 && runs[i - 1].w < g * 2.5) continue; // Ruhezone davor (großzügig)
      for (const kind of [13, 8]) { const c = decodeRuns(runs, i, kind); if (c) return c; }
    }
  }
  return null;
}

export function decodeEan(gray, width, height) {
  const fractions = [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75, 0.2, 0.8, 0.15, 0.85];
  for (const f of fractions) {
    const y = Math.min(height - 1, Math.max(0, Math.round(height * f)));
    const c = decodeLine(gray.subarray(y * width, (y + 1) * width));
    if (c) return c;
  }
  return null;
}

// Hilfsfunktion für den Browser: RGBA (ImageData) in Graustufen umrechnen.
export function toGray(rgba, width, height) {
  const g = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  return g;
}
