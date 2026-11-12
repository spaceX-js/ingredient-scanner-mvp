# Release v0.4.0

## Product Index / D1
- Adds Cloudflare D1 as a barcode-first product index.
- `products`: EAN-level identity.
- `retailer_products`: retailer mappings such as dm DAN and Rossmann product URL.
- `product_fields`: best known field values with source/confidence.
- Resolver reads D1 first, then calls only the relevant retailer detail path when a mapping exists.
- Index failures are non-fatal; lookup falls back to the v0.3 multi-source resolver.

## Initial verified mappings
- `4031244004895` -> dm DAN `3118830`
- `4068134219077` -> Rossmann DAN `227170` and verified product URL

## Setup
1. Create/bind D1 database as `DB` (already done in the Cloudflare dashboard).
2. Run `d1-schema.sql` in the D1 Console.
3. Run `d1-seed.sql` in the D1 Console.
4. Keep the dashboard binding, or copy the `d1_databases` block from `wrangler.d1.example.jsonc` into `wrangler.jsonc` after inserting the real database ID.
