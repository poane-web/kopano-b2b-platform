-- Seed data only (schema is applied from backend/src/schema.sql)
INSERT INTO suppliers (name, contact_person, phone, commission_rate, email)
SELECT 'Botswana Wholesale Distributors', 'Mr. Kgosi', '+2673901234', 5.00, 'bwd@suppliers.local'
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = 'Botswana Wholesale Distributors');

INSERT INTO suppliers (name, contact_person, phone, commission_rate, email)
SELECT 'Sefalana Cash & Carry', 'Ms. Mpho', '+2673975678', 6.00, 'sefalana@suppliers.local'
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = 'Sefalana Cash & Carry');

INSERT INTO suppliers (name, contact_person, phone, commission_rate, email)
SELECT 'PPC Botswana', 'Mr. Thabo', '+2673639012', 4.50, 'ppc@suppliers.local'
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = 'PPC Botswana');

INSERT INTO buying_groups (supplier_id, product_name, category, description, unit_price, retail_price, target_quantity, current_quantity, unit, deadline, pickup_location)
SELECT s.id, '25kg Rice — Royal Aroma', 'food', 'Premium long-grain rice, 25kg bag', 185.00, 240.00, 200, 0, 'bags', NOW() + INTERVAL '2 days', 'LEA Hub, Francistown'
FROM suppliers s WHERE s.name = 'Botswana Wholesale Distributors'
AND NOT EXISTS (SELECT 1 FROM buying_groups WHERE product_name = '25kg Rice — Royal Aroma');

INSERT INTO buying_groups (supplier_id, product_name, category, description, unit_price, retail_price, target_quantity, current_quantity, unit, deadline, pickup_location)
SELECT s.id, '5L Cooking Oil x 4', 'food', 'Vegetable cooking oil, pack of 4', 320.00, 420.00, 80, 0, 'crates', NOW() + INTERVAL '3 days', 'Sefalana Francistown'
FROM suppliers s WHERE s.name = 'Sefalana Cash & Carry'
AND NOT EXISTS (SELECT 1 FROM buying_groups WHERE product_name = '5L Cooking Oil x 4');

INSERT INTO buying_groups (supplier_id, product_name, category, description, unit_price, retail_price, target_quantity, current_quantity, unit, deadline, pickup_location)
SELECT s.id, 'Cement — PPC 50kg', 'construction', 'PPC Surebuild 50kg cement bags', 95.00, 125.00, 150, 0, 'bags', NOW() + INTERVAL '5 days', 'PPC Depot, Francistown'
FROM suppliers s WHERE s.name = 'PPC Botswana'
AND NOT EXISTS (SELECT 1 FROM buying_groups WHERE product_name = 'Cement — PPC 50kg');
