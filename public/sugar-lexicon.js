// Kleines Zuckerlexikon: erklärt, was hinter einem gefundenen Begriff steckt. Kurz, sachlich, ohne Heilsversprechen.
const FREE = "Zählt als zugesetzter Zucker.";
const SYRUP = "Zählt nach der WHO-Definition zu den freien Zuckern (dazu gehören Honig, Sirupe und Fruchtsaftkonzentrate).";
const E = {
  "zucker": ["Haushaltszucker (Saccharose)", "Meist aus Zuckerrüben oder Zuckerrohr. " + FREE],
  "saccharose": ["Haushaltszucker", "Doppelzucker aus Glucose und Fructose. " + FREE],
  "rohrzucker": ["Zucker aus Zuckerrohr", "Chemisch Saccharose, auch wenn er braun oder „naturbelassen“ wirkt. " + FREE],
  "rübenzucker": ["Zucker aus Zuckerrüben", "Chemisch Saccharose. " + FREE],
  "vollrohrzucker": ["Brauner Rohrzucker", "Enthält noch etwas Melasse, besteht aber überwiegend aus Saccharose. " + FREE],
  "kokosblütenzucker": ["Zucker aus dem Blütennektar der Kokospalme", "Besteht überwiegend aus Saccharose und hat ähnlich viele Kalorien wie Haushaltszucker. " + FREE],
  "puderzucker": ["Fein gemahlener Haushaltszucker", FREE],
  "traubenzucker": ["Glucose", "Einfachzucker, geht schnell ins Blut. " + FREE],
  "dextrose": ["Glucose", "Anderer Name für Traubenzucker. " + FREE],
  "glukose": ["Glucose (Traubenzucker)", "Einfachzucker. " + FREE],
  "fruchtzucker": ["Fructose", "Einfachzucker, wird anders verstoffwechselt als Glucose. " + FREE],
  "fruktose": ["Fructose (Fruchtzucker)", FREE],
  "glukosesirup": ["Sirup aus Stärke", "Meist aus Mais oder Weizen, flüssig und günstig. " + FREE],
  "fruktosesirup": ["Sirup mit hohem Fructoseanteil", FREE],
  "glukose-fruktose-sirup": ["Sirup aus Glucose und Fructose", FREE],
  "invertzuckersirup": ["Gespaltener Haushaltszucker", "Gemisch aus Glucose und Fructose, bleibt flüssig. " + FREE],
  "karamellsirup": ["Karamellisierter Zuckersirup", FREE],
  "malzzucker": ["Maltose", "Doppelzucker aus zwei Glucose-Bausteinen. " + FREE],
  "maltose": ["Malzzucker", "Doppelzucker aus zwei Glucose-Bausteinen. " + FREE],
  "agavendicksaft": ["Eingedickter Saft der Agave", "Enthält viel Fructose. Er ist kein zuckerfreier Ersatz. " + SYRUP],
  "ahornsirup": ["Eingedickter Saft des Ahornbaums", "Besteht überwiegend aus Zucker. " + SYRUP],
  "honig": ["Honig", "Besteht überwiegend aus Glucose und Fructose. " + SYRUP],
  "dattelsirup": ["Eingedickter Dattelsaft", SYRUP],
  "dattelpaste": ["Püree aus Datteln", "Enthält die Zucker der Frucht und wird oft zum Süßen genutzt. " + SYRUP],
  "apfeldicksaft": ["Eingedickter Apfelsaft", SYRUP],
  "birnendicksaft": ["Eingedickter Birnensaft", SYRUP],
  "apfelsaftkonzentrat": ["Eingedickter Apfelsaft", "Wird zum Süßen verwendet. " + SYRUP],
  "fruchtsaftkonzentrat": ["Eingedickter Fruchtsaft", "Wird zum Süßen verwendet. " + SYRUP],
  "reissirup": ["Sirup aus Reisstärke", "Besteht überwiegend aus Glucose und Maltose. " + SYRUP],
  "acesulfam k": ["Süßstoff E950", "Kalorienfrei, deutlich süßer als Zucker."],
  "sucralose": ["Süßstoff E955", "Kalorienfrei, deutlich süßer als Zucker."],
  "aspartam": ["Süßstoff E951", "Kalorienarm. Für Menschen mit Phenylketonurie ungeeignet, deshalb steht ein Warnhinweis auf der Packung."],
  "saccharin": ["Süßstoff E954", "Kalorienfrei, deutlich süßer als Zucker."],
  "cyclamat": ["Süßstoff E952", "Kalorienfrei, deutlich süßer als Zucker."],
  "steviolglykoside": ["Süßstoff E960", "Aus der Stevia-Pflanze gewonnen, kalorienfrei."],
  "erythrit": ["Zuckeraustauschstoff E968", "Kaum Kalorien, wirkt kaum auf den Blutzucker."],
  "xylit": ["Zuckeraustauschstoff E967", "Weniger Kalorien als Zucker, kann in größeren Mengen abführen."],
  "sorbit": ["Zuckeraustauschstoff E420", "Weniger Kalorien als Zucker, kann in größeren Mengen abführen."],
  "isomalt": ["Zuckeraustauschstoff E953", "Weniger Kalorien als Zucker, kann in größeren Mengen abführen."],
  "maltit": ["Zuckeraustauschstoff E965", "Weniger Kalorien als Zucker, kann in größeren Mengen abführen."],
  "mannit": ["Zuckeraustauschstoff E421", "Weniger Kalorien als Zucker, kann in größeren Mengen abführen."],
  "süßstoff": ["Süßstoff", "Kalorienfreier Zuckerersatz, deutlich süßer als Zucker."]
};

// Liefert { title, text, known } zu einem gefundenen Begriff (Groß-/Kleinschreibung egal).
export function explain(label) {
  const key = String(label || "").toLowerCase().replace(/[*\s]+$/g, "").trim();
  if (E[key]) return { title: E[key][0], text: E[key][1], known: true };
  if (/zucker$/.test(key)) return { title: label, text: "Eine Zuckerart. " + FREE, known: false };
  if (/sirup$|dicksaft$/.test(key)) return { title: label, text: "Ein Süßungssirup. " + SYRUP, known: false };
  return { title: label, text: "Süßende Zutat.", known: false };
}
