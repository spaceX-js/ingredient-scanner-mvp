// Minimale D1-Attrappe für genau die SQL-Statements des Index. Kein SQL-Parser: Erkennung per Muster.
export class FakeD1 {
  constructor() { this.products = new Map(); this.retailers = []; this.fields = new Map(); this.batches = 0; this.writes = 0; }
  prepare(sql) {
    const db = this;
    return {
      bind(...args) {
        return {
          async first() { return /FROM products WHERE ean/.test(sql) ? db.products.get(args[0]) || null : null; },
          async all() {
            if (/FROM retailer_products/.test(sql)) return { results: db.retailers.filter((r) => r.ean === args[0] && r.status === "active") };
            if (/FROM product_fields/.test(sql)) return { results: [...db.fields.values()].filter((f) => f.ean === args[0]) };
            return { results: [] };
          },
          async run() {
            db.writes++;
            if (/INSERT INTO products/.test(sql)) {
              const [ean, name, brand, updated_at] = args; const prev = db.products.get(ean);
              db.products.set(ean, { ean, name: name ?? prev?.name ?? null, brand: brand ?? prev?.brand ?? null, status: "active", updated_at });
            } else if (/INSERT INTO product_fields/.test(sql)) {
              const [ean, field, value_json, source, source_url, confidence, verified_at] = args;
              db.fields.set(`${ean}|${field}`, { ean, field, value_json, source, source_url, confidence, verified_at });
            } else if (/INSERT INTO retailer_products/.test(sql)) {
              const [ean, retailer, external_id, product_url, last_seen] = args;
              const i = db.retailers.findIndex((r) => r.ean === ean && r.retailer === retailer);
              const row = { ean, retailer, external_id, product_url, status: "active", last_seen };
              if (i >= 0) db.retailers[i] = { ...db.retailers[i], ...row, external_id: external_id ?? db.retailers[i].external_id, product_url: product_url ?? db.retailers[i].product_url }; else db.retailers.push(row);
            }
          }
        };
      }
    };
  }
  async batch(stmts) { this.batches++; for (const s of stmts) await s.run(); }
  seedField(ean, field, value, { source, confidence, verified_at = new Date().toISOString(), source_url = null }) {
    this.fields.set(`${ean}|${field}`, { ean, field, value_json: JSON.stringify(value), source, source_url, confidence, verified_at });
  }
}

// fetch-Stub: erste passende Route gewinnt, Aufrufe werden protokolliert.
export function stubFetch(routes) {
  const original = globalThis.fetch; const calls = [];
  globalThis.fetch = async (input) => {
    const url = String(input); calls.push(url);
    for (const [match, respond] of routes) if (typeof match === "string" ? url.includes(match) : match.test(url)) return respond(url);
    return new Response("not found", { status: 404 });
  };
  return { calls, restore() { globalThis.fetch = original; } };
}
export const jsonRes = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
export const htmlRes = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/html" } });
