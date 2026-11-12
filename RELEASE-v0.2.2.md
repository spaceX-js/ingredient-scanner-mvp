# MVP v0.2.2

Rossmann discovery now uses the observed live search path `GET /de/search?text={EAN}`. The transient `_rsc` query parameter is intentionally not hardcoded.

Diagnostics distinguish `search_http_error`, `product_link_missing`, `product_page_error`, `ean_mismatch`, and `ingredients_missing`.

Primary live regression EAN: `4068134219077`.
