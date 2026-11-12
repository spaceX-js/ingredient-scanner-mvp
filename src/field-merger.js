const CONF={none:0,low:1,medium:2,high:3,verified:4};
const SOURCE={"KlarZutaten Index":45,"dm":40,"Rossmann HTML":40,"Rossmann Search":38,"Rossmann/Syndigo":25,"Open Food Facts":20};
export function createMergeResult(ean){return {ean,product:{ean},fields:{},sources:[],resolver_trace:[]}}
export function addCandidate(result,candidate){
  if(!candidate) return result;
  result.resolver_trace.push({source:candidate.source||"unknown",found:Boolean(candidate.found),confidence:candidate.confidence||null,reason:candidate.reason||null,...(candidate.meta||{})});
  if(Array.isArray(candidate.trace)) for(const d of candidate.trace) result.resolver_trace.push({source:candidate.source||"unknown",...d});
  if(!candidate.found) return result;
  const src=candidate.source||"unknown", conf=candidate.confidence||"medium", score=(CONF[conf]||0)*100+(SOURCE[src]||0);
  for(const [field,value] of Object.entries(candidate.product||{})){
    if(value==null||value===""||field==="ean") continue;
    const prev=result.fields[field];
    if(!prev||score>prev.score){result.product[field]=value; result.fields[field]={source:src,source_url:candidate.source_url||null,confidence:conf,score}}
  }
  if(!result.sources.some(x=>x.source===src&&x.source_url===candidate.source_url)) result.sources.push({source:src,source_url:candidate.source_url||null,confidence:conf});
  return result;
}
export function publicFields(fields){return Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,{source:v.source,source_url:v.source_url,confidence:v.confidence}]))}
