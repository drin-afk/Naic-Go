-- =====================================================================
-- NaicGo DEMONSTRATION SEED DATA  (OPTIONAL — FOR DEVELOPMENT ONLY)
-- ---------------------------------------------------------------------
-- EVERY record below is FICTIONAL DEMONSTRATION DATA. Terminal names,
-- coordinates, routes, stops, fares, vehicles and advisories are
-- placeholders and DO NOT describe real transportation in Naic, Cavite.
-- All rows are flagged is_demo = 1 / verification_status = 'demo' and
-- the UI labels them "DEMO". Researchers must replace them with verified
-- data (Admin dashboard, or delete these rows) before evaluation.
--
-- Import AFTER schema.sql:   mysql -u root -p naicgo_db < database/seed.sql
-- Demo user accounts are created separately by:  npm run seed:demo-users
-- (so that no password hashes or plaintext passwords live in SQL files).
-- =====================================================================
USE naicgo_db;

-- Vehicle type ids: 1 = tricycle, 2 = jeepney, 3 = bus (inserted by schema.sql)

-- ---------------------------------------------------------------------
-- Terminals (placeholder coordinates near the Naic town area — NOT verified)
-- ---------------------------------------------------------------------
INSERT INTO terminals (id, name, address, barangay, latitude, longitude, description, operating_hours,
                       status, verification_status, verified_at, is_demo) VALUES
 (1, 'DEMO Terminal A – Town Proper', 'Placeholder address – replace with verified address', 'Town Proper (demo)',
     14.3190000, 120.7665000, 'Demonstration terminal. Location is a placeholder, not a surveyed point.', '5:00 AM – 9:00 PM (demo)',
     'active', 'demo', NULL, 1),
 (2, 'DEMO Terminal B – Public Market Area', 'Placeholder address – replace with verified address', 'Market Area (demo)',
     14.3170000, 120.7700000, 'Demonstration terminal. Location is a placeholder.', '4:30 AM – 8:00 PM (demo)',
     'active', 'demo', NULL, 1),
 (3, 'DEMO Terminal C – Highway Junction', 'Placeholder address – replace with verified address', 'Highway Area (demo)',
     14.3060000, 120.7780000, 'Demonstration terminal. Location is a placeholder.', '24 hours (demo)',
     'active', 'demo', NULL, 1),
 (4, 'DEMO Terminal D – Coastal Barangay', 'Placeholder address – replace with verified address', 'Coastal Area (demo)',
     14.3290000, 120.7560000, 'Demonstration terminal. Location is a placeholder.', '6:00 AM – 7:00 PM (demo)',
     'active', 'demo', NULL, 1),
 (5, 'DEMO Terminal E – School Zone', 'Placeholder address – replace with verified address', 'School Area (demo)',
     14.3120000, 120.7600000, 'Demonstration terminal. Location is a placeholder.', '6:00 AM – 6:00 PM (demo)',
     'active', 'demo', NULL, 1);

INSERT INTO terminal_vehicle_types (terminal_id, vehicle_type_id) VALUES
 (1,1),(1,2),(2,1),(2,2),(3,2),(3,3),(4,1),(5,1);

-- ---------------------------------------------------------------------
-- Routes
-- ---------------------------------------------------------------------
INSERT INTO routes (id, code, name, origin, destination, vehicle_type_id, distance_km, description,
                    requires_transfer, transfer_notes, status, verification_status, verified_at, is_demo) VALUES
 (1, 'DEMO-J01', 'Town Proper – Highway Junction (Jeepney)', 'DEMO Terminal A – Town Proper', 'DEMO Terminal C – Highway Junction',
     2, 3.80, 'Demonstration jeepney route.', 0, NULL, 'active', 'demo', NULL, 1),
 (2, 'DEMO-J02', 'Highway Junction – Town Proper (Jeepney)', 'DEMO Terminal C – Highway Junction', 'DEMO Terminal A – Town Proper',
     2, 3.80, 'Demonstration jeepney route (return direction).', 0, NULL, 'active', 'demo', NULL, 1),
 (3, 'DEMO-T01', 'Town Proper – Coastal Barangay (Tricycle)', 'DEMO Terminal A – Town Proper', 'DEMO Terminal D – Coastal Barangay',
     1, 2.10, 'Demonstration tricycle route.', 0, NULL, 'active', 'demo', NULL, 1),
 (4, 'DEMO-T02', 'Public Market – School Zone (Tricycle)', 'DEMO Terminal B – Public Market Area', 'DEMO Terminal E – School Zone',
     1, 1.40, 'Demonstration tricycle route.', 0, NULL, 'active', 'demo', NULL, 1),
 (5, 'DEMO-B01', 'Highway Junction – Town Boundary (Bus)', 'DEMO Terminal C – Highway Junction', 'Neighboring Town Boundary (demo)',
     3, 6.50, 'Demonstration bus segment. Riders continuing beyond the municipality should confirm with the conductor.',
     0, NULL, 'active', 'demo', NULL, 1),
 (6, 'DEMO-T03', 'Public Market – Coastal Barangay via Bay Road (Tricycle)', 'DEMO Terminal B – Public Market Area', 'DEMO Terminal D – Coastal Barangay',
     1, 2.60, 'Demonstration tricycle route used as a documented alternative to DEMO-T01.', 0, NULL, 'active', 'demo', NULL, 1);

INSERT INTO route_stops (route_id, stop_order, name, terminal_id, latitude, longitude, is_boarding, is_dropoff) VALUES
 (1,1,'DEMO Terminal A – Town Proper',1,14.3190000,120.7665000,1,0),
 (1,2,'DEMO Terminal B – Public Market Area',2,14.3170000,120.7700000,1,1),
 (1,3,'Hospital Area (demo stop)',NULL,14.3110000,120.7740000,1,1),
 (1,4,'DEMO Terminal C – Highway Junction',3,14.3060000,120.7780000,0,1),
 (2,1,'DEMO Terminal C – Highway Junction',3,14.3060000,120.7780000,1,0),
 (2,2,'Hospital Area (demo stop)',NULL,14.3110000,120.7740000,1,1),
 (2,3,'DEMO Terminal B – Public Market Area',2,14.3170000,120.7700000,1,1),
 (2,4,'DEMO Terminal A – Town Proper',1,14.3190000,120.7665000,0,1),
 (3,1,'DEMO Terminal A – Town Proper',1,14.3190000,120.7665000,1,0),
 (3,2,'Riverside Chapel (demo stop)',NULL,14.3240000,120.7610000,1,1),
 (3,3,'DEMO Terminal D – Coastal Barangay',4,14.3290000,120.7560000,0,1),
 (4,1,'DEMO Terminal B – Public Market Area',2,14.3170000,120.7700000,1,0),
 (4,2,'DEMO Terminal E – School Zone',5,14.3120000,120.7600000,0,1),
 (5,1,'DEMO Terminal C – Highway Junction',3,14.3060000,120.7780000,1,0),
 (5,2,'Neighboring Town Boundary (demo)',NULL,14.2950000,120.7900000,0,1),
 (6,1,'DEMO Terminal B – Public Market Area',2,14.3170000,120.7700000,1,0),
 (6,2,'Bay Road Crossing (demo stop)',NULL,14.3250000,120.7650000,1,1),
 (6,3,'DEMO Terminal D – Coastal Barangay',4,14.3290000,120.7560000,0,1);

INSERT INTO route_terminals (route_id, terminal_id, role) VALUES
 (1,1,'origin'),(1,2,'intermediate'),(1,3,'destination'),
 (2,3,'origin'),(2,2,'intermediate'),(2,1,'destination'),
 (3,1,'origin'),(3,4,'destination'),
 (4,2,'origin'),(4,5,'destination'),
 (5,3,'origin'),
 (6,2,'origin'),(6,4,'destination');

-- ---------------------------------------------------------------------
-- Fares (DEMO amounts — not official fare matrices)
-- ---------------------------------------------------------------------
INSERT INTO fares (route_id, passenger_category, fare_type, amount_min, amount_max, effective_date, source,
                   verification_status, verified_at, is_current, notes) VALUES
 (1,'regular','range',13.00,18.00,'2026-01-01','Demonstration value','demo',NULL,0,'Superseded demo fare kept to show history'),
 (1,'regular','range',14.00,20.00,'2026-07-01','Demonstration value','demo',NULL,1,'Depends on drop-off point (demo)'),
 (1,'student','range',11.00,16.00,'2026-07-01','Demonstration value','demo',NULL,1,NULL),
 (1,'senior_pwd','range',11.00,16.00,'2026-07-01','Demonstration value','demo',NULL,1,NULL),
 (2,'regular','range',14.00,20.00,'2026-07-01','Demonstration value','demo',NULL,1,NULL),
 (3,'regular','fixed',30.00,30.00,'2026-07-01','Demonstration value','demo',NULL,1,'Per passenger, shared ride (demo)'),
 (4,'regular','fixed',20.00,20.00,'2026-07-01','Demonstration value','demo',NULL,1,NULL),
 (5,'regular','requires_confirmation',NULL,NULL,NULL,'Demonstration value','demo',NULL,1,'Confirm fare with conductor (demo)'),
 (6,'regular','range',30.00,40.00,'2026-07-01','Demonstration value','demo',NULL,1,NULL);

-- ---------------------------------------------------------------------
-- Vehicles (fictional identifiers)
-- ---------------------------------------------------------------------
INSERT INTO vehicles (id, identifier, vehicle_type_id, description, capacity, color, status, is_demo) VALUES
 (1,'DEMO-TRI-001',1,'Demonstration tricycle',4,'Blue','active',1),
 (2,'DEMO-TRI-002',1,'Demonstration tricycle',4,'Red','active',1),
 (3,'DEMO-JEEP-001',2,'Demonstration jeepney',18,'Silver','active',1),
 (4,'DEMO-JEEP-002',2,'Demonstration jeepney',18,'White','active',1),
 (5,'DEMO-BUS-001',3,'Demonstration bus',45,'White','active',1);

-- ---------------------------------------------------------------------
-- Documented alternatives
-- ---------------------------------------------------------------------
INSERT INTO route_alternatives (route_id, alternative_route_id, notes) VALUES
 (3,6,'Board at DEMO Terminal B instead and take the Bay Road route (demo).'),
 (6,3,'Board at DEMO Terminal A instead (demo).');

-- ---------------------------------------------------------------------
-- Demo road obstruction notice (published so the alternative-route flow can be shown)
-- ---------------------------------------------------------------------
INSERT INTO road_obstruction_reports (title, location_description, latitude, longitude, description, affected_route_id,
                                      reported_at, verification_status, resolution_status, is_published, is_demo) VALUES
 ('DEMO: Road repair near Riverside Chapel stop', 'Near Riverside Chapel (demo stop)', 14.3240000, 120.7610000,
  'DEMONSTRATION NOTICE ONLY. One lane closed for road repair (fictional).', 3,
  NOW(), 'verified', 'active', 1, 1);
