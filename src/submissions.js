import { confidenceRank } from "./field-merger.js";
import { sanitizeIngredientText, sanitizeName } from "../public/ingredient-text.js";

export const USER_SOURCE = "Nutzer-Foto";
const MAX_BODY = 20000;

// Nutzer-Einreichung: speichert Zutaten mit niedriger Confidence und überschreibt nie geprüfte Händler- oder Handdaten.
export async function submitIngredients(db, ean, body) {
  if (!db) return { ok: false, status: 503, error: "Index nicht verfügbar." };
  const clean = sanitizeIngredientText(body?.text);
  if (!clean.ok) return { ok: false, status: 400, error: clean.error };
  const name = sanitizeName(body?.name);
  try {
    const existing = await db.prepare(`SELECT field, source, confidence FROM product_fields WHERE ean = ?1 AND field = 'ingredients'`).bind(String(ean)).first();
    if (existing && existing.source !== USER_SOURCE && confidenceRank(existing.confidence) >= confidenceRank("high")) {
      return { ok: false, status: 409, error: "Für dieses Produkt gibt es bereits geprüfte Zutaten." };
    }
    const stamp = new Date().toISOString();
    const stmts = [
      db.prepare(`INSERT INTO products (ean,name,brand,status,updated_at) VALUES (?1,?2,?3,'active',?4)
        ON CONFLICT(ean) DO UPDATE SET name=COALESCE(excluded.name,products.name), brand=COALESCE(excluded.brand,products.brand), updated_at=excluded.updated_at`).bind(String(ean), name, null, stamp),
      db.prepare(`INSERT INTO product_fields (ean,field,value_json,source,source_url,confidence,verified_at) VALUES (?1,?2,?3,?4,?5,?6,?7)
        ON CONFLICT(ean,field) DO UPDATE SET value_json=excluded.value_json,source=excluded.source,source_url=excluded.source_url,confidence=excluded.confidence,verified_at=excluded.verified_at`)
        .bind(String(ean), "ingredients", JSON.stringify(clean.text), USER_SOURCE, null, "low", stamp)
    ];
    if (typeof db.batch === "function") await db.batch(stmts); else for (const s of stmts) await s.run();
    return { ok: true, status: 200 };
  } catch {
    return { ok: false, status: 500, error: "Speichern fehlgeschlagen." };
  }
}

export { MAX_BODY };
