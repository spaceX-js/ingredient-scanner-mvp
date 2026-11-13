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


## v0.5.0 – Scanner-Oberfläche

- Kamera-Barcodescanner (native `BarcodeDetector`, Fallback ZXing aus dem CDN, z. B. für iPhone) mit manueller EAN-Eingabe.
- Ergebnisansicht mit Ampel, gefundenen Zuckerarten/Süßungsmitteln/Zusatzstoffen, markierter Zutatenliste und Datenqualität.
- API: neues Feld `assessment` (`verdict`: `added_sugar | sweeteners | sweetening_ingredients | none_detected | uncertain | unknown`, `quality`: `high | medium | low | none`). Fehlende Zutaten ergeben immer `unknown`, nie "kein Zucker".
- Engine: Zusammensetzungen auf -zucker (Kokosblütenzucker, Vollrohrzucker …) zählen als zugesetzter Zucker.
- Rossmann ist aus (`ENABLE_ROSSMANN=1` schaltet ihn ein).

## v0.6.0 – Zutaten per Foto erfassen

- Unbekannte Produkte (oder Produkte mit unsicherer Datenlage) bieten „Zutaten erfassen“: Foto der Zutatenliste, Texterkennung **im Browser** (Tesseract.js, deutsch), Prüfen/Korrigieren, Speichern. Alternativ Text einfügen (iPhone: Live Text im Kamerabild).
- `POST /api/product/{EAN}/ingredients` mit `{ "text": "...", "name": "optional" }`: speichert in D1 mit Quelle `Nutzer-Foto`, Confidence `low` (Anzeige: "uncertain", wenn nichts Auffälliges gefunden wird). Geprüfte Händler-/Handdaten werden nie überschrieben (409). Nur gleiche Herkunft (Origin), Text ≤ 3000 Zeichen, keine Markup-Zeichen/Links.
- Keine Serverkosten für die Texterkennung: sie läuft auf dem Gerät des Nutzers.

### OCR-Dateien (ab v0.6.1 automatisch)
Beim Deploy führt `wrangler` vorher `scripts/vendor-ocr.mjs` aus (`build.command` in `wrangler.jsonc`). Das Skript kopiert Tesseract.js (Version aus `package.json`) und die deutschen Sprachdaten nach `public/ocr/`. Die Seite erkennt `/ocr/tesseract.min.js` und nutzt dann nur eigene Dateien. Schlägt der Schritt fehl, wird nur gewarnt und die Seite nutzt das CDN. `public/ocr/` steht in `.gitignore`.

## v0.7.0 – Zuckermenge und Zuckerlexikon

- API: neues Feld `sugar_amount` (`grams_per_100g`, `teaspoons_per_100g`, `level` low/medium/high nach FSA-Schwellen 5 g und 22,5 g pro 100 g, optional `grams_per_serving`). Quelle sind die Nährwerte aus dm, Open Food Facts oder manuell gepflegte Daten; ohne Nährwerte `null`, nie 0.
- Oberfläche: Karte "Zucker gesamt" mit Teelöffeln und Ampelleiste, Hinweis wenn viel Zucker enthalten ist, obwohl keiner zugesetzt wurde. Tippen auf einen gefundenen Begriff zeigt eine Erklärung (`public/sugar-lexicon.js`).
