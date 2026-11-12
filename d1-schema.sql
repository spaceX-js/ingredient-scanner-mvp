PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  ean TEXT PRIMARY KEY,
  name TEXT,
  brand TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS retailer_products (
  ean TEXT NOT NULL,
  retailer TEXT NOT NULL,
  external_id TEXT,
  product_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ean, retailer),
  FOREIGN KEY (ean) REFERENCES products(ean) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_fields (
  ean TEXT NOT NULL,
  field TEXT NOT NULL,
  value_json TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium',
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ean, field),
  FOREIGN KEY (ean) REFERENCES products(ean) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_retailer_external_id ON retailer_products(retailer, external_id);
CREATE INDEX IF NOT EXISTS idx_fields_source ON product_fields(source);
