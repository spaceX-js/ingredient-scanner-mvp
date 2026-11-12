# KlarZutaten / Ingredient Scanner MVP v0.3.0

Cloudflare-Worker-MVP für Barcode-/GTIN-basierte Produktauflösung und verständliche Zutatenanalyse.

## Architektur

`EAN -> unabhängige Quellen -> Field Merger -> Ingredient Engine`

Quellen in v0.3.0:
- Open Food Facts
- Rossmann v1: EAN-Discovery, Produktseite, Syndigo-Fallback
- dm v1: EAN-Suche (wenn die Live-Suche DAN liefert) und strukturierte Product-Detail-API über DAN

Der Resolver fragt Quellen unabhängig ab. Eine vorhandene OFF-Zutatenliste verhindert **nicht** mehr, dass Händlerdaten geprüft werden. Pro Feld gewinnt der Kandidat mit der höheren Confidence/Source-Priorität; `fields` dokumentiert Quelle und Confidence.

## API
- `GET /api/health`
- `GET /api/version`
- `GET /api/product/{EAN}`
- optional für dm-Diagnose: `?dm_dan=3118830`

## Datenstatus
Ein technisch funktionierender Adapter garantiert keine 100% Händler-Coverage. Fehlen Zutaten beim Händler, meldet der Resolver `MISSING_INGREDIENTS` statt Daten zu erfinden.

## Tests
Echte Browser-Fixtures liegen unter `test/fixtures/`:
- Rossmann Search/RSC für `4068134219077`
- dm Product Detail für `4031244004895` / DAN `3118830`

`npm test` prüft Parser und Ingredient Engine offline.

## Entwicklung
```bash
npm install
npm test
npm run dev
```

Deployment:
```bash
npm run deploy
```

## Recht / Betrieb
Vor produktiver oder kommerzieller Nutzung Händlerbedingungen, robots.txt, Lizenzen und zulässige Abruffrequenzen prüfen. Produktdaten cachen; keine unnötigen Händlerabrufe pro Nutzerrequest.
