# KlarZutaten / Ingredient Scanner MVP v0.4.1

Barcode-first food ingredient scanner MVP on Cloudflare Workers.

## Architecture (v0.4.1)
`EAN (GTIN-Prüfziffer) -> D1 index -> [fresh? answer from cache] -> OFF + Rossmann + dm (parallel) -> Syndigo (nur wenn nötig) -> field merger -> ingredient engine -> persist`

D1 is an index/cache layer, not the only source of truth. It stores EAN identity, retailer mappings (dm DAN, Rossmann product URL) and best-known fields **with their original source and confidence**. If D1 is unavailable or not initialized, the app falls back to the multi-source resolver.

- **Cache:** Liegen Zutaten aus einer geprüften Händlerquelle (dm, Rossmann HTML) innerhalb der TTL im Index, werden keine Upstream-Abrufe gemacht (`index.cache: "hit"`). TTL: 168 h, per Variable `CACHE_TTL_HOURS` änderbar.
- **Was gespeichert wird:** nur frisch geprüfte Händlerwerte (Confidence >= high) und Mappings, die der Adapter bestätigt hat (EAN stand auf der Händlerseite bzw. im dm-Detail). Open-Food-Facts-Daten werden nicht gespeichert. Das Schreiben ist ein einziger D1-Batch und läuft per `ctx.waitUntil` nach der Antwort.
- **Retailer-Felder:** `dm_dan`, `dm_url`, `rossmann_dan`, `rossmann_url` (vorher kollidierten `dan` und `productUrl`).

## D1 setup
The Worker expects the D1 binding name `DB`.

1. Bind `ingredient-scanner-db` to the Worker as `DB`.
2. Execute `d1-schema.sql` in the D1 Console.
3. Execute `d1-seed.sql` in the D1 Console.
4. For reproducible Wrangler configuration, copy the `d1_databases` block from `wrangler.d1.example.jsonc` into `wrangler.jsonc` and replace the placeholder with your real D1 database ID.

## API
- `GET /api/health`
- `GET /api/version`
- `GET /api/product/{EAN}` — EAN muss eine gültige GTIN (8/12/13/14 Stellen, Prüfziffer) sein, sonst `400`.

### Admin-Hints
`?rossmann_url=https://www.rossmann.de/...` und `?dm_dan=1234567` überspringen die Händlersuche. Sie werden **nur** mit Header `x-admin-token` und gesetztem Secret `ADMIN_TOKEN` akzeptiert (sonst ignoriert, Antwort enthält `hints_ignored: true`). Zusätzlich: nur `https://www.rossmann.de`, nur 5–9-stellige DAN. Die Händlerseite bzw. das dm-Detail muss die angefragte EAN enthalten, sonst wird das Ergebnis verworfen.

```bash
npx wrangler secret put ADMIN_TOKEN
```
Das Repo ist öffentlich: Tokens und Schlüssel gehören nie hinein.

## Tests
```bash
npm test
```
Offline (fetch-Stubs, In-Memory-D1-Attrappe). Live-Abrufe gegen Händler sind nicht Teil der Tests.

## Initial regression EANs
- dm: `4031244004895`
- Rossmann: `4068134219077`
