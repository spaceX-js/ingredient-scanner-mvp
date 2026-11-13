# Release v0.4.1 (Hardening)

## Sicherheit / Datenintegrität
- `rossmann_url` und `dm_dan` waren öffentlich und ungeprüft: fremde URLs wurden serverseitig abgerufen, das Ergebnis galt als "verified" und wurde in D1 gespeichert (Index-Poisoning). Jetzt nur noch mit `x-admin-token`, Host-Allowlist und DAN-Format.
- EAN-Abgleich in allen ID-/URL-Pfaden (`getRossmannByUrl`, `getRossmannByEan`, `getDmByDan`): stimmt die EAN nicht, werden keine Daten übernommen.
- GTIN-Prüfziffer: ungültige EANs liefern `400` ohne Upstream-Abruf und ohne D1-Schreibzugriff.
- Frontend: alle Fremdwerte werden HTML-escaped (XSS).

## Index / Cache
- Confidence-Laundering behoben: `indexCandidate` machte jedes gespeicherte Feld pauschal "verified". Jetzt behalten Index-Werte Quelle und Confidence; ein gespeicherter OFF-Wert (medium) schlägt keine frischen Händlerdaten mehr.
- Index-Treffer innerhalb der TTL (7 Tage) beantworten die Anfrage ohne Upstream-Abrufe.
- Nur Händlerwerte mit Confidence >= high werden gespeichert; Mappings (dm DAN, Rossmann URL) werden automatisch gelernt.
- Ein D1-Batch statt eines Statements pro Feld; Schreiben per `ctx.waitUntil`.
- OFF, Rossmann und dm laufen parallel; Syndigo nur, wenn keine Zutaten mit Confidence >= high vorliegen.
- Retailer-Felder getrennt: `dm_dan`, `dm_url`, `rossmann_dan`, `rossmann_url` (vorher überschrieben sich `dan` und `productUrl`).

## Parser
- Rossmann: JSON-Feld wurde bei maskierten Anführungszeichen abgeschnitten (`decode()` lief vor der Regex).
- Rossmann: Inline-Tags (`<strong>MANDELN</strong>`) ergaben "MANDELN ,"; Spurenhinweis/Bio-Satz gehören nicht mehr zu den Zutaten.

## Aufräumen
- `.gitignore` ergänzt, tote `vitest.config.js` entfernt, `npm test` führt alle Tests aus (24 `node:test`-Tests plus Skript-Tests).
