// Zuckermenge aus Nährwerten (Open-Food-Facts-Objekt oder dm-ähnliche Tabelle "Bezeichnung -> Wert").
// Zucker gesamt enthält auch natürlich vorhandenen Zucker (Früchte, Milch) und ist nicht "zugesetzter Zucker".
const TEASPOON_G = 4; // üblicher Richtwert: 1 Teelöffel ≈ 4 g Zucker
// Ampel nach den britischen FSA-Schwellen für feste Lebensmittel pro 100 g.
const LOW_MAX = 5, MEDIUM_MAX = 22.5;

const num = (v) => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : null; };

function grams(text) {
  const m = String(text ?? "").match(/(\d+(?:[.,]\d+)?)\s*(mg|g)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return /mg/i.test(m[2]) ? n / 1000 : n;
}

export function sugarLevel(per100g) {
  if (per100g == null) return null;
  return per100g <= LOW_MAX ? "low" : per100g <= MEDIUM_MAX ? "medium" : "high";
}

const round1 = (n) => Math.round(n * 10) / 10;

export function extractSugar(nutrition) {
  if (!nutrition || typeof nutrition !== "object") return null;
  let per100 = null, perServing = null, servingLabel = null;
  if ("sugars_100g" in nutrition || "sugars" in nutrition) {
    // Open Food Facts: Werte in der Einheit sugars_unit (meist g).
    const unit = String(nutrition.sugars_unit || "g").toLowerCase();
    const f = unit === "mg" ? 0.001 : unit === "g" ? 1 : null;
    if (f != null) {
      const a = num(nutrition.sugars_100g ?? nutrition.sugars), b = num(nutrition.sugars_serving);
      per100 = a == null ? null : a * f; perServing = b == null ? null : b * f;
    }
  } else {
    for (const [key, value] of Object.entries(nutrition)) {
      if (!/zucker/i.test(key) || /zuckerart|zuckeraustausch|zuckerzusatz/i.test(key)) continue;
      const g = grams(value); if (g == null) continue;
      if (/portion|riegel|stück|scheibe/i.test(key)) { if (perServing == null) perServing = g; } else if (per100 == null) per100 = g;
    }
    if (typeof nutrition.Portion === "string") servingLabel = nutrition.Portion.slice(0, 40);
  }
  if (per100 == null) return null;
  const out = {
    grams_per_100g: round1(per100),
    teaspoons_per_100g: round1(per100 / TEASPOON_G),
    level: sugarLevel(per100),
    basis: "Ampel nach FSA-Schwellen pro 100 g (niedrig bis 5 g, mittel bis 22,5 g, hoch darüber). 1 Teelöffel ≈ 4 g.",
    includes_natural_sugar: true
  };
  if (perServing != null) { out.grams_per_serving = round1(perServing); out.teaspoons_per_serving = round1(perServing / TEASPOON_G); if (servingLabel) out.serving = servingLabel; }
  return out;
}
