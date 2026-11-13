import { confidenceRank } from "./field-merger.js";

const nowIso = () => new Date().toISOString();

// Nur Felder, die der Index als Cache hält. Retailer-IDs/-URLs liegen in retailer_products.
const PERSIST_FIELDS = ["name", "brand", "ingredients", "allergens", "nutrition", "image", "claims", "withoutAddedSugar"];
// Nur Retailer-Quellen mit Prüfung (Confidence >= high) werden gespeichert. Open-Food-Facts-Daten sind
// jederzeit neu abrufbar und gehören nicht in den "geprüften" Index.
const MIN_PERSIST_CONFIDENCE = "high";
const FRESH_SOURCES = ["dm", "Rossmann HTML"];

export async function getIndexedProduct(db, ean) {
  if (!db) return null;
  try {
    const key = String(ean);
    const [product, retailers, fields] = await Promise.all([
      db.prepare(`SELECT ean, name, brand, status, updated_at FROM products WHERE ean = ?1`).bind(key).first(),
      db.prepare(`SELECT retailer, external_id, product_url, status, last_seen FROM retailer_products WHERE ean = ?1 AND status = 'active'`).bind(key).all(),
      db.prepare(`SELECT field, value_json, source, source_url, confidence, verified_at FROM product_fields WHERE ean = ?1`).bind(key).all()
    ]);
    if (!product && !(retailers?.results?.length) && !(fields?.results?.length)) return null;
    return {
      product: product || { ean: key },
      retailers: retailers?.results || [],
      fields: (fields?.results || []).map((x) => ({ ...x, value: safeJson(x.value_json) }))
    };
  } catch (error) {
    // Fehlendes Schema / nicht erreichbare DB darf den Barcode-Lookup nie brechen.
    return { error: "index_unavailable", message: error?.message || String(error), retailers: [], fields: [] };
  }
}

function safeJson(value) {
  try { return JSON.parse(value); } catch { return value; }
}

export function hintsFromIndex(index) {
  const hints = {};
  for (const row of index?.retailers || []) {
    if (row.retailer === "dm" && row.external_id) hints.dm_dan = String(row.external_id);
    if (row.retailer === "rossmann") {
      if (row.external_id) hints.rossmann_dan = String(row.external_id);
      if (row.product_url) hints.rossmann_url = row.product_url;
    }
  }
  return hints;
}

// Index-Einträge behalten Quelle und Confidence, mit der sie gespeichert wurden. Ein gespeicherter
// "medium"-Wert wird beim Wiederlesen nicht zu "verified" aufgewertet.
export function indexCandidates(index, ean) {
  if (!index || index.error) return [];
  const groups = new Map();
  for (const f of index.fields || []) {
    if (!f.field || f.value == null || f.field === "ean") continue;
    const key = `${f.source}\u0000${f.confidence}\u0000${f.source_url || ""}`;
    if (!groups.has(key)) groups.set(key, { found: true, source: f.source, source_url: f.source_url || null, confidence: f.confidence || "medium", product: { ean: String(ean) }, meta: { from_index: true, verified_at: f.verified_at } });
    groups.get(key).product[f.field] = f.value;
  }
  const out = [...groups.values()];
  // Von Hand gepflegte Stammdaten (z. B. Seed): gelten als "high", nicht als frisch geprüfter Händlerwert.
  const base = { ean: String(ean) };
  if (index.product?.name) base.name = index.product.name;
  if (index.product?.brand) base.brand = index.product.brand;
  if (Object.keys(base).length > 1) out.push({ found: true, source: "KlarZutaten Index", confidence: "high", product: base, meta: { from_index: true } });
  return out;
}

// Frisch genug, um Upstream-Abrufe zu überspringen: Zutaten aus einer geprüften Händlerquelle innerhalb der TTL.
export function isFresh(index, { now = Date.now(), ttlHours = 168 } = {}) {
  if (!index || index.error) return false;
  const row = (index.fields || []).find((f) => f.field === "ingredients");
  if (!row || !FRESH_SOURCES.includes(row.source)) return false;
  if (confidenceRank(row.confidence) < confidenceRank(MIN_PERSIST_CONFIDENCE)) return false;
  const t = Date.parse(row.verified_at);
  return Number.isFinite(t) && now - t < ttlHours * 3600 * 1000;
}

// Schreibt nur frisch geprüfte Händlerwerte und bestätigte Mappings (EAN stand auf der Händlerseite).
// Alles in einem Batch: ein Roundtrip statt einem pro Feld, und atomar.
export async function persistResolvedProduct(db, { ean, product, fields, mappings }) {
  if (!db || !ean) return { written: 0 };
  try {
    const stamp = nowIso();
    const rows = [];
    for (const field of PERSIST_FIELDS) {
      const meta = fields?.[field];
      const value = product?.[field];
      if (!meta || meta.from_index || value == null || value === "") continue;
      if (confidenceRank(meta.confidence) < confidenceRank(MIN_PERSIST_CONFIDENCE)) continue;
      rows.push({ field, value, meta });
    }
    const maps = (mappings || []).filter((m) => m?.retailer && (m.external_id || m.product_url));
    if (!rows.length && !maps.length) return { written: 0 };

    const stmts = [];
    const name = rows.find((r) => r.field === "name")?.value || null;
    const brand = rows.find((r) => r.field === "brand")?.value || null;
    stmts.push(db.prepare(`INSERT INTO products (ean,name,brand,status,updated_at) VALUES (?1,?2,?3,'active',?4)
      ON CONFLICT(ean) DO UPDATE SET name=COALESCE(excluded.name,products.name), brand=COALESCE(excluded.brand,products.brand), updated_at=excluded.updated_at`)
      .bind(String(ean), name, brand, stamp));
    for (const { field, value, meta } of rows) {
      stmts.push(db.prepare(`INSERT INTO product_fields (ean,field,value_json,source,source_url,confidence,verified_at) VALUES (?1,?2,?3,?4,?5,?6,?7)
        ON CONFLICT(ean,field) DO UPDATE SET value_json=excluded.value_json,source=excluded.source,source_url=excluded.source_url,confidence=excluded.confidence,verified_at=excluded.verified_at`)
        .bind(String(ean), field, JSON.stringify(value), meta.source || "unknown", meta.source_url || null, meta.confidence || "medium", stamp));
    }
    for (const m of maps) {
      stmts.push(db.prepare(`INSERT INTO retailer_products (ean,retailer,external_id,product_url,status,last_seen) VALUES (?1,?2,?3,?4,'active',?5)
        ON CONFLICT(ean,retailer) DO UPDATE SET external_id=COALESCE(excluded.external_id,retailer_products.external_id),product_url=COALESCE(excluded.product_url,retailer_products.product_url),status='active',last_seen=excluded.last_seen`)
        .bind(String(ean), m.retailer, m.external_id || null, m.product_url || null, stamp));
    }
    if (typeof db.batch === "function") await db.batch(stmts);
    else for (const s of stmts) await s.run();
    return { written: stmts.length };
  } catch {
    return { written: 0 }; // Index-Schreibzugriffe sind best-effort.
  }
}
