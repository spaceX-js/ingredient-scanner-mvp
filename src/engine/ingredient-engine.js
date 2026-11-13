const ADDED_SUGAR = [
  [/(^|[,(;:\s])zucker([),;:\s]|$)/i,"Zucker"], [/rohrzucker/i,"Rohrzucker"], [/rübenzucker/i,"Rübenzucker"],
  [/zuckerrübensirup/i,"Zuckerrübensirup"], [/saccharose/i,"Saccharose"], [/traubenzucker/i,"Traubenzucker"],
  [/dextrose/i,"Dextrose"], [/fruchtzucker/i,"Fruchtzucker"], [/fruktose/i,"Fruktose"], [/glukose/i,"Glukose"],
  [/glukosesirup/i,"Glukosesirup"], [/fruktosesirup/i,"Fruktosesirup"], [/glukose-fruktose-sirup/i,"Glukose-Fruktose-Sirup"],
  [/invertzuckersirup/i,"Invertzuckersirup"], [/karamellsirup/i,"Karamellsirup"], [/malzzucker/i,"Malzzucker"], [/maltose/i,"Maltose"]
];
const SWEETENERS = [
  [/acesulfam\s*k/i,"Acesulfam K"], [/sucralose/i,"Sucralose"], [/aspartam/i,"Aspartam"], [/saccharin/i,"Saccharin"],
  [/steviolglykosid/i,"Steviolglykoside"], [/cyclamat/i,"Cyclamat"], [/erythrit/i,"Erythrit"], [/xylit/i,"Xylit"],
  [/sorbit/i,"Sorbit"], [/isomalt/i,"Isomalt"], [/maltit/i,"Maltit"], [/mannit/i,"Mannit"], [/\bsüßstoff(?:e|en)?\b/i,"Süßstoff"]
];
const SWEETENING = [
  [/honig/i,"Honig"], [/agavendicksaft/i,"Agavendicksaft"], [/ahornsirup/i,"Ahornsirup"], [/dattelsirup/i,"Dattelsirup"],
  [/dattelpaste/i,"Dattelpaste"], [/apfeldicksaft/i,"Apfeldicksaft"], [/apfelsaftkonzentrat/i,"Apfelsaftkonzentrat"],
  [/fruchtsaftkonzentrat/i,"Fruchtsaftkonzentrat"], [/birnendicksaft/i,"Birnendicksaft"], [/reissirup/i,"Reissirup"]
];
const ADDITIVES = [
  [/citronensäure|zitronensäure|\be\s*330\b/i,"E330","Citronensäure","Säuerungsmittel"],
  [/sorbinsäure|\be\s*200\b/i,"E200","Sorbinsäure","Konservierungsstoff"],
  [/kaliumsorbat|\be\s*202\b/i,"E202","Kaliumsorbat","Konservierungsstoff"],
  [/natriumbenzoat|\be\s*211\b/i,"E211","Natriumbenzoat","Konservierungsstoff"],
  [/ascorbinsäure|\be\s*300\b/i,"E300","Ascorbinsäure","Antioxidationsmittel"],
  [/lecithin|\be\s*322\b/i,"E322","Lecithine","Emulgator"],
  [/guarkernmehl|\be\s*412\b/i,"E412","Guarkernmehl","Verdickungsmittel"],
  [/johannisbrotkernmehl|\be\s*410\b/i,"E410","Johannisbrotkernmehl","Verdickungsmittel"],
  [/xanthan|\be\s*415\b/i,"E415","Xanthan","Verdickungsmittel"],
  [/pektin|\be\s*440\b/i,"E440","Pektin","Geliermittel"],
  [/carrageen|\be\s*407\b/i,"E407","Carrageen","Verdickungsmittel"],
  [/carboxymethylcellulose|\be\s*466\b/i,"E466","Carboxymethylcellulose","Verdickungsmittel"],
  [/mono-?\s*und\s*diglyceride|\be\s*471\b/i,"E471","Mono- und Diglyceride von Speisefettsäuren","Emulgator"],
  [/acesulfam\s*k|\be\s*950\b/i,"E950","Acesulfam K","Süßungsmittel"],
  [/aspartam|\be\s*951\b/i,"E951","Aspartam","Süßungsmittel"],
  [/cyclamat|\be\s*952\b/i,"E952","Cyclamat","Süßungsmittel"],
  [/saccharin|\be\s*954\b/i,"E954","Saccharin","Süßungsmittel"],
  [/sucralose|\be\s*955\b/i,"E955","Sucralose","Süßungsmittel"],
  [/steviolglykosid|\be\s*960\b/i,"E960","Steviolglykoside","Süßungsmittel"]
];
function clean(raw){return String(raw||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()}
function ingredientText(text){
  return text.replace(/\bzuckerfrei(?:e|er|es|en|em)?\b/gi,"").replace(/\bohne\s+zuckerzusatz\b/gi,"").replace(/\bohne\s+zugesetzten\s+zucker\b/gi,"");
}
function hits(text,rules){const out=[]; for(const [re,label] of rules){if(re.test(text)&&!out.includes(label))out.push(label)} return out}
export function analyseIngredients(raw=""){
  const text=clean(raw), scan=ingredientText(text);
  const added=hits(scan,ADDED_SUGAR), sweeteners=hits(scan,SWEETENERS), sweetening=hits(scan,SWEETENING);
  // Zusammensetzungen auf -zucker (Kokosblütenzucker, Vollrohrzucker, Puderzucker ...) ohne Einzelliste erkennen.
  for(const m of scan.matchAll(/[\p{L}-]*zucker(?![\p{L}])/giu)){
    const w=m[0].replace(/^-+/,"");
    if(w.length>6&&!added.some(x=>x.toLowerCase()===w.toLowerCase()))added.push(w.charAt(0).toUpperCase()+w.slice(1));
  }
  const additives=[]; for(const [re,code,name,fn] of ADDITIVES){if(re.test(scan)&&!additives.some(x=>x.code===code)) additives.push({code,name,function:fn})}
  return {added_sugar:added.length>0,added_sugar_matches:added,sweeteners_present:sweeteners.length>0,sweetener_matches:sweeteners,sweetening_ingredients_present:sweetening.length>0,sweetening_ingredient_matches:sweetening,additives,confidence:text?"high":"none"};
}
