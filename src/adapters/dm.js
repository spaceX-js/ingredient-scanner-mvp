const SEARCH="https://product-search.services.dmtech.com/de/guided-search";
const DETAIL=(dan)=>`https://products.dm.de/product/products/detail/DE/dan/${encodeURIComponent(dan)}`;
function textArray(group){return (group?.contentBlock||[]).flatMap(b=>b.texts||[]).filter(Boolean)}
function group(json,name){return (json?.descriptionGroups||[]).find(g=>String(g.header||"").trim().toLowerCase()===name.toLowerCase())}
function stripIngredients(s=""){const i=s.indexOf("Zutaten:"); if(i>=0)s=s.slice(i+8); return s.split(/Bitte beachte|Kann Spuren|\*aus kontrolliert/i)[0].replace(/\s+/g," ").trim()}
export function parseDmProduct(json){
  if(!json||typeof json!=="object") return null;
  const ing=stripIngredients(textArray(group(json,"Zutaten")).join(" "))||null;
  const allergens=textArray(group(json,"Allergene")).join(" ").replace(/\s+/g," ").trim()||null;
  const nutritionGroup=group(json,"Nährwerte"); const nutrition={};
  for(const block of nutritionGroup?.contentBlock||[]) for(const row of block.table||[]){if(Array.isArray(row)&&row.length>=2) nutrition[String(row[0]).trim()]=String(row[1]).trim()}
  const pills=Array.isArray(json.pills)?json.pills:[];
  return {ean:String(json.gtin||json?.seoInformation?.structuredData?.gtin||""),dan:String(json.dan||""),name:json?.title?.headline||json?.seoInformation?.structuredData?.name||null,brand:json?.brand?.name||json?.seoInformation?.structuredData?.brand||null,ingredients:ing,allergens,nutrition:Object.keys(nutrition).length?nutrition:null,image:json?.images?.[0]?.src||null,productUrl:json?.metadata?.canonical||json?.self||null,claims:pills,withoutAddedSugar:pills.some(x=>/ohne zuckerzusatz/i.test(x))};
}
function findDan(node,ean){if(!node||typeof node!=="object")return null;if(Array.isArray(node)){for(const x of node){const h=findDan(x,ean);if(h)return h}return null} const gt=String(node.gtin||node.ean||node.GTIN||""); if(gt===String(ean)&&node.dan)return String(node.dan); for(const v of Object.values(node)){const h=findDan(v,ean);if(h)return h} return null}
// Retailer-spezifische Felder tragen den Retailer im Namen (siehe Rossmann-Adapter).
function toProduct(p){
  const {dan,productUrl,...rest}=p;
  return {...rest,dm_dan:dan||null,dm_url:productUrl||null};
}
const headers={Accept:"application/json","Accept-Language":"de-DE,de;q=0.9"};

// Detailabruf per DAN. Die EAN muss zum Ergebnis passen, sonst landen Daten eines anderen Produkts unter dieser EAN.
async function fetchDetail(dan,ean,trace=[]){
  const url=DETAIL(dan);
  try{
    const r=await fetch(url,{headers});
    if(!r.ok)return{found:false,source:"dm",reason:"detail_http_error",trace:[...trace,{step:"dm_detail",http_status:r.status}]};
    const p=parseDmProduct(await r.json());
    if(!p)return{found:false,source:"dm",reason:"parse_failed",trace};
    if(p.ean!==String(ean))return{found:false,source:"dm",reason:"ean_mismatch",trace:[...trace,{step:"dm_detail",expected_ean:String(ean),got_ean:p.ean||null}]};
    return{found:true,source:"dm",source_url:url,confidence:"verified",product:toProduct(p),mapping:{retailer:"dm",external_id:String(dan),product_url:p.productUrl||null},trace};
  }catch{
    return{found:false,source:"dm",reason:"detail_fetch_error",trace};
  }
}

export async function getDmByEan(ean){
  let dan=null; const trace=[];
  try{
    const u=`${SEARCH}?query=${encodeURIComponent(ean)}&pageSize=5&enablePharmacy=true`;
    const r=await fetch(u,{headers});
    const body=await r.text();
    trace.push({step:"dm_search",http_status:r.status,response_bytes:body.length,...(r.ok&&body.length>2?{}:{location:r.headers.get("location")||null,server:r.headers.get("server")||null,snippet:body.slice(0,120)})});
    if(r.ok&&body.trim()){try{dan=findDan(JSON.parse(body),ean)}catch{}}
  }catch{trace.push({step:"dm_search",reason:"fetch_error"})}
  if(!dan)return{found:false,source:"dm",reason:"ean_to_dan_unresolved",trace};
  return fetchDetail(dan,ean,trace);
}

export async function getDmByDan(dan,ean){return fetchDetail(dan,ean)}
