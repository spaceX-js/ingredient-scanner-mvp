# Ingredient Scanner MVP / KlarZutaten

Aktueller Release: **MVP v0.2.0**

Cloudflare-Worker-MVP für Barcode/EAN-Auflösung und verständliche Zutatenanalyse.

## Architektur

- Static Frontend aus `public/`
- Cloudflare Worker API in `src/index.js`
- Multi-Source Resolver in `src/resolver.js`
- Open Food Facts als Basis
- Rossmann HTML serverseitig als Händler-Fallback
- Rossmann/Syndigo als ergänzender Fallback mit niedrigerer Confidence
- dm Parser vorbereitet; generische EAN->URL-Discovery ist noch offen
- Ingredient Engine in `src/engine/ingredient-engine.js`

## API

- `GET /api/health`
- `GET /api/version`
- `GET /api/product/{EAN}`

Regressionstest Rossmann: `4068134219077`.

## Versionierung

Die Laufzeitversion liegt zentral in `src/version.js`. Die UI zeigt die aktuelle Version sichtbar an und lädt zusätzlich `/api/version`.

## Entwicklung

```bash
npm install
npm run check
npm test
npm run dev
```

Deployment:

```bash
npm run deploy
```

## Bekannte Grenzen

Rossmann-URL-Discovery wird aktuell aus Marke + Produktname der Basisquelle abgeleitet. Das funktioniert für reguläre Rossmann-Lebensmittel-URLs, ist aber noch kein vollständiger Katalogresolver. dm benötigt weiterhin eine generische EAN->Produkt-URL-Auflösung.
