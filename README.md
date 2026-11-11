# Ingredient Scanner MVP / KlarZutaten

MVP für eine deutsche Barcode-Plattform, die Zutaten verständlich macht. Das Repository ist für **Cloudflare Workers + Static Assets** vorbereitet.

## Architektur

Browser → Cloudflare Worker `/api/product/:ean` → Multi-Source Resolver → Ingredient Engine.

Aktuell implementiert:
- Open Food Facts: World v2 → DE v2 → Legacy
- Rossmann/Syndigo Enhanced Content als Fallback (mittlere Confidence)
- Rossmann-HTML-Parser für bekannte Produkt-URLs (serverseitig; kein Browser-CORS)
- dm-HTML-Parser für bekannte Produkt-URLs
- Ingredient Engine v0.1: zugesetzter Zucker, Süßungsmittel, süßende Zutaten, ausgewählte Zusatzstoffe
- Feldweise Quellen-/Confidence-Metadaten

Noch offen:
- stabile EAN→Produkt-URL-Discovery für Rossmann und dm
- persistente Produktdatenbank (später z. B. Cloudflare D1)
- Kamera-Barcodescanner
- vollständige Zusatzstofftaxonomie
- 200-EAN-Regressionstest als maschinenlesbare Fixture übernehmen

## Lokal starten

Voraussetzung: Node.js 20+.

```bash
npm install
npm run dev
```

Danach die von Wrangler angezeigte lokale URL öffnen.

## Tests

```bash
npm test
```

Cloudflare empfiehlt für neue Workers-Projekte die Workers-Vitest-Integration; dieses Repo ist dafür konfiguriert.

## Deployment

```bash
npx wrangler login
npm run deploy
```

Alternativ das GitHub-Repository in Cloudflare verbinden und als Deploy-Befehl `npm run deploy` verwenden.

## API

`GET /api/health`

`GET /api/product/{EAN}`

Optionale Test-Hints, solange die Händler-URL-Discovery noch fehlt:

`?rossmann_url=https://www.rossmann.de/...`

`?dm_url=https://www.dm.de/...`

## Datenqualität

KlarZutaten trennt Datenquelle und Analyse. Syndigo Enhanced Product Content wird nicht automatisch als vollständige gesetzliche Zutatenliste behandelt und erhält deshalb niedrigere Confidence als eine vollständige Händler-Zutatenliste.

## Recht / Betrieb

Vor einem öffentlichen kommerziellen Launch müssen Nutzungsbedingungen, Robots-/Abrufregeln und Datenbanklizenzen der jeweiligen Quellen geprüft werden. Open Food Facts steht unter ODbL; die Datenarchitektur sollte diese Lizenzgrenzen berücksichtigen.
