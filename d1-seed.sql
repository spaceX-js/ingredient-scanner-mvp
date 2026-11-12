INSERT INTO products (ean,name,brand,status) VALUES
('4031244004895','Kinderteller Spaghetti Bolognese ab 1 Jahr, 250 g','Alete','active'),
('4068134219077','Haferriegel Lebkuchen Schoko','enerBiO','active')
ON CONFLICT(ean) DO UPDATE SET name=excluded.name,brand=excluded.brand,status='active';

INSERT INTO retailer_products (ean,retailer,external_id,product_url,status) VALUES
('4031244004895','dm','3118830','https://www.dm.de/p/d/3118830/alete-kinderteller-spaghetti-bolognese-ab-1-jahr','active'),
('4068134219077','rossmann','227170','https://www.rossmann.de/de/lebensmittel-enerbio-haferriegel-lebkuchen-schoko/p/4068134219077','active')
ON CONFLICT(ean,retailer) DO UPDATE SET external_id=excluded.external_id,product_url=excluded.product_url,status='active',last_seen=CURRENT_TIMESTAMP;
