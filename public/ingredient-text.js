// Text aus OCR bereinigen (Browser) und Einreichungen prüfen (Server). Keine Abhängigkeiten.
const STOP = /\b(?:Nährwert\w*|Durchschnittliche\s+Nährwert\w*|Brennwert|Aufbewahr\w*|Mindestens\s+haltbar\w*|Hergestellt|Abgefüllt|Vertrieben|Hersteller|Ursprungsland|Lebensmittelunternehmer|Nach\s+dem\s+Öffnen|Kühl\s+lagern|Trocken\s+lagern|Verpackt\s+in)\b/i;
const TRACES = /\b(?:Kann\s+Spuren|Spuren\s+von|Kann\s+.{0,40}?\s+enthalten|Hergestellt\s+in\s+einem\s+Betrieb)\b/i;

export function normalizeOcrText(raw = "") {
  return String(raw)
    .replace(/­/g, "")
    .replace(/(\p{L})-\s*\n\s*(\p{Ll})/gu, "$1$2") // Silbentrennung am Zeilenende
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/[|]/g, "I")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .trim();
}

// Liefert { ingredients, traces, found }. Ohne "Zutaten"-Marke wird der ganze Text als Kandidat zurückgegeben (found=false).
export function extractIngredientText(raw = "") {
  const text = normalizeOcrText(raw);
  const m = text.match(/\bZutaten\s*:?\s*/i);
  let body = m ? text.slice(m.index + m[0].length) : text;
  const stop = body.search(STOP);
  if (stop >= 0) body = body.slice(0, stop);
  let traces = null;
  const t = body.search(TRACES);
  if (t >= 0) { traces = body.slice(t).replace(/[\s.]+$/, "").trim() || null; body = body.slice(0, t); }
  body = body.replace(/[\s.;:,-]+$/, "").trim();
  return { ingredients: body, traces, found: Boolean(m) };
}

// Serverseitige Prüfung: nur Text, begrenzte Länge, keine Markup-Zeichen. Rückgabe { ok, text } oder { ok:false, error }.
export function sanitizeIngredientText(value, { min = 3, max = 3000 } = {}) {
  if (typeof value !== "string") return { ok: false, error: "Text fehlt." };
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/[<>`]/g, "").replace(/\s+/g, " ").trim();
  if (text.length < min) return { ok: false, error: "Text ist zu kurz." };
  if (text.length > max) return { ok: false, error: `Text ist zu lang (maximal ${max} Zeichen).` };
  const letters = (text.match(/\p{L}/gu) || []).length;
  if (letters < min || letters / text.length < 0.4) return { ok: false, error: "Das sieht nicht nach einer Zutatenliste aus." };
  if (/https?:\/\/|www\./i.test(text)) return { ok: false, error: "Links sind nicht erlaubt." };
  return { ok: true, text };
}

export function sanitizeName(value, max = 120) {
  if (typeof value !== "string") return null;
  const t = value.replace(/[\u0000-\u001f\u007f<>`]/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}
