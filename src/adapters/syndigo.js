const ROSSMANN_SITE_ID = "7e43d4bf-0b49-430a-995f-828ac38496d8";

function stripHtml(value = "") {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#252;/g, "ü").replace(/&#223;/g, "ß").replace(/\s+/g, " ").trim();
}

function findIngredientCopy(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) { const hit = findIngredientCopy(item); if (hit) return hit; }
    return null;
  }
  if (String(node.caption || "").toLowerCase() === "zutaten" && node.description) return stripHtml(node.description);
  for (const value of Object.values(node)) { const hit = findIngredientCopy(value); if (hit) return hit; }
  return null;
}

export async function getRossmannSyndigo(ean) {
  const url = `https://content.syndigo.com/page/${ROSSMANN_SITE_ID}/${ean}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { found: false, source: "Rossmann/Syndigo" };
    const json = await res.json();
    const ingredients = findIngredientCopy(json);
    if (!ingredients) return { found: true, source: "Rossmann/Syndigo", confidence: "low", product: { ean, ingredients: null } };
    return { found: true, source: "Rossmann/Syndigo", source_url: url, confidence: "medium", product: { ean, ingredients } };
  } catch (_) {
    return { found: false, source: "Rossmann/Syndigo" };
  }
}
