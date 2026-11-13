// GTIN-8/12/13/14 mit Prüfziffer (GS1 Modulo 10). Ungültige Codes gar nicht erst nachschlagen:
// das spart Upstream-Abrufe und verhindert Schreibzugriffe auf D1 für erfundene EANs.
export function isValidGtin(value) {
  const s = String(value ?? "");
  if (!/^(?:\d{8}|\d{12,14})$/.test(s)) return false;
  const digits = [...s].map(Number);
  const check = digits.pop();
  let sum = 0;
  digits.reverse().forEach((d, i) => { sum += d * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === check;
}
