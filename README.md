# KlarZutaten / Ingredient Scanner MVP v0.4.0

Barcode-first food ingredient scanner MVP on Cloudflare Workers.

## v0.4.0 architecture
`EAN -> D1 Product Index -> known retailer detail adapter -> other sources -> field merger -> ingredient engine`

D1 is an index/cache layer, not the only source of truth. It stores EAN identity, retailer mappings (e.g. dm DAN, Rossmann product URL), and best-known fields with provenance. If D1 is unavailable or not initialized, the app falls back to the v0.3.0 multi-source resolver.

## D1 setup
The Worker expects the D1 binding name `DB`.

1. Bind `ingredient-scanner-db` to the Worker as `DB`.
2. Execute `d1-schema.sql` in the D1 Console.
3. Execute `d1-seed.sql` in the D1 Console.
4. For reproducible Wrangler configuration, copy the `d1_databases` block from `wrangler.d1.example.jsonc` into `wrangler.jsonc` and replace the placeholder with your real D1 database ID.

## API
- `GET /api/health`
- `GET /api/version`
- `GET /api/product/{EAN}`

## Initial regression EANs
- dm: `4031244004895`
- Rossmann: `4068134219077`
