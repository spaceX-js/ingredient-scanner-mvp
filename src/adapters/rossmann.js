const ROSSMANN_BASE = "https://www.rossmann.de";

function slugify(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripHtml(value = "") {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEscapedHtml(value = "") {
  return value
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ");
}

function buildCandidates(product, ean) {
  const brand = slugify(product?.brands || "");
  const name = slugify(product?.product_name || "");

  const candidates = new Set();

  if (brand && name) {
    candidates.add(
      `${ROSSMANN_BASE}/de/lebensmittel-${brand}-${name}/p/${ean}`
    );
  }

  if (name) {
    candidates.add(
      `${ROSSMANN_BASE}/de/lebensmittel-${name}/p/${ean}`
    );
  }

  return [...candidates];
}

function extractIngredients(html) {
  const decoded = decodeEscapedHtml(html);

  const patterns = [
    /(?:Zutaten|ZUTATEN)[^:]{0,100}:?\s*<\/?[^>]*>?\s*([^]{20,2500}?)(?=(?:Nährwert|Naehrwert|Allergen|Aufbewahrung|Verwendung|<\/section>|<\/div>))/i,

    /"(?:ingredients|ingredientText|ingredientsText)"\s*:\s*"([^"]{10,2500})"/i,

    /(?:Zutaten|ZUTATEN)[\s\S]{0,300}?((?:\d+\s*%\s*)?[A-Za-zÄÖÜäöüß][\s\S]{20,1800}?)(?=Nährwert|Naehrwert|Allergen)/i
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);

    if (match?.[1]) {
      const cleaned = stripHtml(match[1]);

      if (cleaned.length >= 10) {
        return cleaned;
      }
    }
  }

  return null;
}

async function fetchRossmannPage(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "de-DE,de;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (compatible; IngredientScannerMVP/0.1)"
    },
    redirect: "follow"
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();

  return {
    html,
    finalUrl: response.url
  };
}

export async function getRossmannByProduct(ean, product = {}) {
  const candidates = buildCandidates(product, ean);

  for (const url of candidates) {
    try {
      const page = await fetchRossmannPage(url);

      if (!page?.html) {
        continue;
      }

      // Schutz gegen Redirects auf Kategorie-, Such- oder Fehlerseiten.
      if (!page.html.includes(String(ean))) {
        continue;
      }

      const ingredients = extractIngredients(page.html);

      if (!ingredients) {
        continue;
      }

      return {
        found: true,
        source: "Rossmann HTML",
        confidence: "high",
        url: page.finalUrl,
        ingredients_text: ingredients
      };
    } catch (error) {
      console.error("Rossmann adapter error", {
        ean,
        url,
        message: error?.message
      });
    }
  }

  return {
    found: false,
    source: "Rossmann HTML",
    confidence: "none",
    ingredients_text: null
  };
}
