const RULES = {
  addedSugar: [
    /(^|[,(;:\s])zucker([),;:\s]|$)/i, /rohrzucker/i, /rübenzucker/i, /saccharose/i,
    /glukose(?!-fruktose)/i, /dextrose/i, /fruktose/i, /glukosesirup/i,
    /fruktosesirup/i, /glukose-fruktose-sirup/i, /invertzuckersirup/i,
    /karamellsirup/i, /malzzucker/i, /maltose/i
  ],
  sweeteners: [
    /acesulfam\s*k/i, /sucralose/i, /aspartam/i, /saccharin/i,
    /steviolglykosid/i, /cyclamat/i, /erythrit/i, /xylit/i, /sorbit/i
  ],
  sweeteningIngredients: [
    /honig/i, /agavendicksaft/i, /ahornsirup/i, /dattelsirup/i, /dattelpaste/i,
    /apfeldicksaft/i, /apfelsaftkonzentrat/i, /fruchtsaftkonzentrat/i,
    /birnendicksaft/i, /reissirup/i
  ]
};

const ADDITIVES = [
  { re: /carrageen|e\s*407/i, code: "E407", name: "Carrageen", function: "Verdickungsmittel" },
  { re: /carboxymethylcellulose|e\s*466/i, code: "E466", name: "Carboxymethylcellulose", function: "Verdickungsmittel" },
  { re: /mono-?\s*und\s*diglyceride|e\s*471/i, code: "E471", name: "Mono- und Diglyceride von Speisefettsäuren", function: "Emulgator" },
  { re: /acesulfam\s*k|e\s*950/i, code: "E950", name: "Acesulfam K", function: "Süßungsmittel" },
  { re: /sucralose|e\s*955/i, code: "E955", name: "Sucralose", function: "Süßungsmittel" },
  { re: /citronensäure|zitronensäure|e\s*330/i, code: "E330", name: "Citronensäure", function: "Säuerungsmittel" },
  { re: /pektin|e\s*440/i, code: "E440", name: "Pektin", function: "Geliermittel" }
];

function matches(text, list) {
  return list.filter((r) => r.test(text)).map((r) => r.source);
}

export function analyseIngredients(raw = "") {
  const text = String(raw).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const addedSugar = matches(text, RULES.addedSugar);
  const sweeteners = matches(text, RULES.sweeteners);
  const sweeteningIngredients = matches(text, RULES.sweeteningIngredients);
  const additives = ADDITIVES.filter((a) => a.re.test(text)).map(({ re, ...rest }) => rest);
  return {
    added_sugar: addedSugar.length > 0,
    sweeteners_present: sweeteners.length > 0,
    sweetening_ingredients_present: sweeteningIngredients.length > 0,
    additives,
    confidence: text ? "high" : "none"
  };
}
