# MVP v0.2.3

- Rossmann Product Discovery now uses the real search mechanism exposed by Rossmann search/RSC data.
- Tries `search.ws/v3/search/products/by-text` endpoints first and validates exact EAN matches.
- Falls back to parsing the public `/de/search?text={EAN}` RSC payload.
- Uses the discovered `productUrl` to load the product page and extract ingredients.
- Regression EAN: `4068134219077`.
