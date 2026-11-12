const nowIso=()=>new Date().toISOString();

export async function getIndexedProduct(db, ean) {
  if (!db) return null;
  try {
    const product = await db.prepare(`SELECT ean, name, brand, status, updated_at FROM products WHERE ean = ?1`).bind(String(ean)).first();
    const retailers = await db.prepare(`SELECT retailer, external_id, product_url, status, last_seen FROM retailer_products WHERE ean = ?1 AND status = 'active'`).bind(String(ean)).all();
    const fields = await db.prepare(`SELECT field, value_json, source, source_url, confidence, verified_at FROM product_fields WHERE ean = ?1`).bind(String(ean)).all();
    if (!product && !(retailers?.results?.length) && !(fields?.results?.length)) return null;
    return {
      product: product || { ean: String(ean) },
      retailers: retailers?.results || [],
      fields: (fields?.results || []).map(x => ({...x, value: safeJson(x.value_json)}))
    };
  } catch (error) {
    // Missing schema / unavailable DB must never break barcode lookup.
    return { error: 'index_unavailable', message: error?.message || String(error), retailers: [], fields: [] };
  }
}

function safeJson(value) {
  try { return JSON.parse(value); } catch { return value; }
}

export function hintsFromIndex(index) {
  const hints = {};
  for (const row of index?.retailers || []) {
    if (row.retailer === 'dm' && row.external_id) hints.dm_dan = String(row.external_id);
    if (row.retailer === 'rossmann') {
      if (row.external_id) hints.rossmann_dan = String(row.external_id);
      if (row.product_url) hints.rossmann_url = row.product_url;
    }
  }
  return hints;
}

export function indexCandidate(index, ean) {
  if (!index || index.error) return null;
  const p = { ean: String(ean) };
  if (index.product?.name) p.name = index.product.name;
  if (index.product?.brand) p.brand = index.product.brand;
  for (const f of index.fields || []) if (f.field && f.value != null) p[f.field] = f.value;
  const hasData = Object.keys(p).length > 1;
  return hasData ? { found: true, source: 'KlarZutaten Index', confidence: 'verified', product: p } : null;
}

export async function persistResolvedProduct(db, resolved) {
  if (!db || !resolved?.ean) return;
  try {
    const p = resolved.product || {};
    await db.prepare(`INSERT INTO products (ean,name,brand,status,updated_at) VALUES (?1,?2,?3,'active',?4)
      ON CONFLICT(ean) DO UPDATE SET name=COALESCE(excluded.name,products.name), brand=COALESCE(excluded.brand,products.brand), updated_at=excluded.updated_at`)
      .bind(String(resolved.ean), p.name || null, p.brand || null, nowIso()).run();
    for (const [field, meta] of Object.entries(resolved.fields || {})) {
      const value = p[field]; if (value == null || value === '') continue;
      await db.prepare(`INSERT INTO product_fields (ean,field,value_json,source,source_url,confidence,verified_at) VALUES (?1,?2,?3,?4,?5,?6,?7)
        ON CONFLICT(ean,field) DO UPDATE SET value_json=excluded.value_json,source=excluded.source,source_url=excluded.source_url,confidence=excluded.confidence,verified_at=excluded.verified_at`)
        .bind(String(resolved.ean), field, JSON.stringify(value), meta.source || 'unknown', meta.source_url || null, meta.confidence || 'medium', nowIso()).run();
    }
  } catch { /* index writes are best-effort */ }
}
