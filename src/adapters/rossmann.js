const BASE="https://www.rossmann.de";
function decode(s=""){return s.replace(/\\u003c/gi,"<").replace(/\\u003e/gi,">").replace(/\\u0026/gi,"&").replace(/\\\"/g,'"').replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#x27;|&#39;/g,"'")}
// Inline-Tags (z. B. <strong>MANDELN</strong>) ohne Leerraum entfernen, Blockelemente/<br> als Leerraum.
const INLINE_TAG=/<\/?(?:strong|b|em|i|u|span|a|sup|sub|small|mark)\b[^>]*>/gi;
function clean(s=""){return decode(s).replace(/<br\s*\/?\s*>/gi," ").replace(INLINE_TAG,"").replace(/<[^>]+>/g," ").replace(/\\n|\\r/g," ").replace(/\s+/g," ").replace(/\s+([,.;:)])/g,"$1").replace(/\(\s+/g,"(").trim()}
export function parseRossmannSearchRsc(text,ean){const d=decode(text), esc=String(ean).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); const m=d.match(new RegExp(`"productUrl"\\s*:\\s*"([^\"]*\\/p\\/${esc})"`,"i")); if(!m)return null; const a=d.slice(Math.max(0,m.index-1800),Math.min(d.length,m.index+3200)); const get=(k)=>(a.match(new RegExp(`"${k}"\\s*:\\s*"([^\"]+)"`,"i"))||[])[1]||null; const productUrl=m[1].startsWith("http")?m[1]:BASE+m[1]; return {ean:String(ean),dan:get("dan"),name:get("name"),brand:get("brandName"),productUrl,image:(a.match(/"image"\s*:\s*\{[^}]*"url"\s*:\s*"([^\"]+)"/i)||[])[1]||null};}
export function extractRossmannIngredients(html=""){
  const d=decode(html);
  // Strukturierte Werte zuerst, und zwar auf dem ROHTEXT: decode() macht aus \" ein ", dann würde die Regex
  // am ersten maskierten Anführungszeichen abschneiden. Der JSON-String wird danach korrekt entpackt.
  for(const re of [/"(?:ingredients|ingredientText|ingredientsText|zutaten)"\s*:\s*"((?:\\.|[^"\\]){2,5000})"/i,/"name"\s*:\s*"Zutaten"[\s\S]{0,700}?"(?:value|text|description)"\s*:\s*"((?:\\.|[^"\\]){2,5000})"/i]){
    const m=String(html).match(re);
    if(m?.[1]){let raw=m[1];try{raw=JSON.parse(`"${m[1]}"`)}catch{}const v=clean(raw);if(v)return v}
  }
  // HTML fallback: keep delimiters intact and allow short ingredient lists.
  const heading=/(?:>\s*Zutaten\s*<|\bZutaten\s*:)/ig; let m;
  while((m=heading.exec(d))){let start=m.index+m[0].length; if(m[0].includes("<")){const close=d.indexOf(">",start); if(close>=0&&close-start<30) start=close+1;} let w=d.slice(start,start+6000); const stop=w.search(/(?:<[^>]*>\s*(?:Nährwerte|Allergene|Aufbewahrung|Verwendung|Hinweise|Lebensmittelunternehmer|Ursprungsland)\b|\b(?:Nährwerte|Allergene|Aufbewahrung|Verwendung)\s*:|\b(?:Kann Spuren|Spuren von|Alle Zutaten sind|Enthält Koffein)\b)/i); if(stop>=0)w=w.slice(0,stop); const v=clean(w).replace(/^[:\s-]+/,""); if(v.length>=3&&v.length<=4000&&!/^hinweise zur zutaten/i.test(v))return v}
  return null;
}
async function fetchText(url,headers={}){const r=await fetch(url,{headers:{"Accept-Language":"de-DE,de;q=0.9","User-Agent":"Mozilla/5.0 (compatible; KlarZutaten/0.4.1)",...headers},redirect:"follow"});const text=await r.text();return{ok:r.ok,status:r.status,url:r.url||url,text,contentType:r.headers.get("content-type")||"",bytes:text.length}}
export async function discoverRossmannProduct(ean){const trace=[],url=`${BASE}/de/search?text=${encodeURIComponent(ean)}`; for(const [mode,headers] of [["html",{Accept:"text/html,application/xhtml+xml"}],["rsc",{Accept:"text/x-component,*/*;q=0.9",RSC:"1","Next-Router-Prefetch":"1"}]]){try{const r=await fetchText(url,headers);const p=r.ok?parseRossmannSearchRsc(r.text,ean):null;trace.push({step:"rossmann_discovery",mode,http_status:r.status,content_type:r.contentType,response_bytes:r.bytes,parser_stage:p?"product_url_found":"product_url_missing",product_found:Boolean(p)});if(p)return{found:true,product:p,trace}}catch{trace.push({step:"rossmann_discovery",mode,parser_stage:"fetch_error"})}} return{found:false,reason:"product_link_missing",trace}}

// Retailer-spezifische Felder tragen den Retailer im Namen. Sonst überschreiben sich z. B. dm-DAN und
// Rossmann-DAN oder die Produkt-URLs gegenseitig im zusammengeführten Produkt.
function toProduct(p,ean,ingredients){
  const {dan,productUrl,...rest}=p||{};
  return {...rest,ean:String(ean),rossmann_dan:dan||null,rossmann_url:productUrl||null,ingredients:ingredients||null};
}
function mappingOf(p){return p?.productUrl?{retailer:"rossmann",external_id:p.dan||null,product_url:p.productUrl}:null}

async function loadProductPage(ean,productUrl,trace){
  const page=await fetchText(productUrl,{Accept:"text/html,application/xhtml+xml"});
  const t={step:"rossmann_product_page",http_status:page.status,content_type:page.contentType,response_bytes:page.bytes,ean_present:page.text.includes(String(ean))};
  trace.push(t);
  return {page,t};
}

// Mapping aus Index (oder Admin-Hint): URL gilt erst als bestätigt, wenn die EAN auf der Seite steht.
export async function getRossmannByUrl(ean,productUrl,seed={}){
  if(!productUrl)return{found:false,source:"Rossmann HTML",reason:"product_url_missing"};
  const trace=[];
  try{
    const {page,t}=await loadProductPage(ean,productUrl,trace);
    t.mode="indexed_url";
    if(!page.ok)return{found:false,source:"Rossmann HTML",reason:"product_page_error",trace};
    if(!t.ean_present)return{found:false,source:"Rossmann HTML",reason:"ean_mismatch",source_url:productUrl,trace};
    const ing=extractRossmannIngredients(page.text);
    t.ingredients_found=Boolean(ing);
    const p={...seed,productUrl};
    return{found:true,source:"Rossmann HTML",source_url:productUrl,confidence:ing?"verified":"high",reason:ing?null:"ingredients_missing",product:toProduct(p,ean,ing),mapping:mappingOf(p),trace};
  }catch{
    return{found:false,source:"Rossmann HTML",reason:"product_page_error",trace};
  }
}

export async function getRossmannByEan(ean){
  const d=await discoverRossmannProduct(ean);
  if(!d.found)return{found:false,source:"Rossmann HTML",reason:d.reason,trace:d.trace};
  const p=d.product, trace=[...d.trace];
  try{
    const {page,t}=await loadProductPage(ean,p.productUrl,trace);
    if(!page.ok)return{found:false,source:"Rossmann HTML",reason:"product_page_error",trace};
    // Die Such-URL endet auf /p/<EAN>; steht die EAN trotzdem nicht auf der Seite, keine Zutaten übernehmen.
    if(!t.ean_present)return{found:true,source:"Rossmann Search",source_url:p.productUrl,confidence:"high",reason:"ean_not_on_page",product:toProduct(p,ean,null),mapping:mappingOf(p),trace};
    const ing=extractRossmannIngredients(page.text);
    t.ingredients_found=Boolean(ing);
    return{found:true,source:"Rossmann HTML",source_url:p.productUrl,confidence:ing?"verified":"high",reason:ing?null:"ingredients_missing",product:toProduct(p,ean,ing),mapping:mappingOf(p),trace};
  }catch{
    return{found:true,source:"Rossmann Search",source_url:p.productUrl,confidence:"high",reason:"product_page_error",product:toProduct(p,ean,null),mapping:mappingOf(p),trace};
  }
}
