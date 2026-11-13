export const CONF = { none: 0, low: 1, medium: 2, high: 3, verified: 4 };
export const confidenceRank = (c) => CONF[c] || 0;

// Rang der Quelle als Tie-Breaker innerhalb derselben Confidence.
const SOURCE = { "KlarZutaten Index": 45, "dm": 40, "Rossmann HTML": 40, "Rossmann Search": 38, "Rossmann/Syndigo": 25, "Open Food Facts": 20 };

export function createMergeResult(ean) {
  return { ean, product: { ean }, fields: {}, sources: [], resolver_trace: [], mappings: [] };
}

// Kandidaten aus dem Index tragen ihre ursprüngliche Quelle und Confidence (meta.from_index).
// Bei Gleichstand ersetzt ein frisch abgerufener Wert den Index-Wert, aber nie umgekehrt.
export function addCandidate(result, candidate) {
  if (!candidate) return result;
  const fromIndex = Boolean(candidate.meta?.from_index);
  result.resolver_trace.push({ source: candidate.source || "unknown", found: Boolean(candidate.found), confidence: candidate.confidence || null, reason: candidate.reason || null, ...(candidate.meta || {}) });
  if (Array.isArray(candidate.trace)) for (const d of candidate.trace) result.resolver_trace.push({ source: candidate.source || "unknown", ...d });
  if (!candidate.found) return result;

  const src = candidate.source || "unknown";
  const conf = candidate.confidence || "medium";
  const score = confidenceRank(conf) * 100 + (SOURCE[src] || 0);
  for (const [field, value] of Object.entries(candidate.product || {})) {
    if (value == null || value === "" || field === "ean") continue;
    const prev = result.fields[field];
    const wins = !prev || score > prev.score || (score === prev.score && prev.from_index && !fromIndex);
    if (wins) {
      result.product[field] = value;
      result.fields[field] = { source: src, source_url: candidate.source_url || null, confidence: conf, score, from_index: fromIndex };
    }
  }
  if (!fromIndex && candidate.mapping?.retailer && !result.mappings.some((m) => m.retailer === candidate.mapping.retailer)) result.mappings.push(candidate.mapping);
  if (!result.sources.some((x) => x.source === src && x.source_url === (candidate.source_url || null))) {
    result.sources.push({ source: src, source_url: candidate.source_url || null, confidence: conf, ...(fromIndex ? { cached: true } : {}) });
  }
  return result;
}

export function publicFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { source: v.source, source_url: v.source_url, confidence: v.confidence, ...(v.from_index ? { cached: true } : {}) }]));
}
