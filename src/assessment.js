// Bewertung für die Oberfläche: aus der Analyse und der Datenlage ein Urteil ableiten.
// Grundregel: Fehlende oder unsichere Zutaten ergeben nie "nichts gefunden", sondern "unknown"/"uncertain".
import { confidenceRank } from "./field-merger.js";

export function dataQuality(meta) {
  if (!meta) return { level: "none", reason: "Keine Zutatenliste vorhanden." };
  const rank = confidenceRank(meta.confidence);
  if (rank >= confidenceRank("high")) return { level: "high", reason: `Zutaten aus geprüfter Quelle (${meta.source}).` };
  if (rank >= confidenceRank("medium")) return { level: "medium", reason: `Zutaten aus Gemeinschaftsdaten (${meta.source}); bitte am Etikett prüfen.` };
  return { level: "low", reason: `Zutaten aus unsicherer Quelle (${meta.source}); unvollständig möglich.` };
}

export function assess(analysis, ingredientsMeta, hasIngredients) {
  const quality = dataQuality(hasIngredients ? ingredientsMeta : null);
  const a = analysis || {};
  let verdict;
  if (!hasIngredients) verdict = "unknown";
  else if (a.added_sugar) verdict = "added_sugar";
  else if (a.sweeteners_present) verdict = "sweeteners";
  else if (a.sweetening_ingredients_present) verdict = "sweetening_ingredients";
  else verdict = quality.level === "low" ? "uncertain" : "none_detected";
  return { verdict, quality: quality.level, quality_reason: quality.reason, ingredients_available: Boolean(hasIngredients) };
}
