-- =====================================================================
-- NaicGo: Web-Based Public Transportation Terminal Route Guide
-- MySQL / MariaDB schema (XAMPP compatible: MariaDB 10.4+ / MySQL 8+)
-- Import:  mysql -u root -p < database/schema.sql
-- WARNING: this script DROPS and recreates the naicgo_db database.
-- =====================================================================

DROP DATABASE IF EXISTS naicgo_db;
CREATE DATABASE naicgo_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE naicgo_db;

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- 1. users
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username         VARCHAR(40)  NOT NULL,
  email            VARCHAR(190) NOT NULL,
  password_hash    VARCHAR(100) NOT NULL,
  full_name        VARCHAR(120) NOT NULL,
  role             ENUM('commuter','driver','admin') NOT NULL,
  status           ENUM('active','pending','suspended','rejected','inactive') NOT NULL DEFAULT 'active',
  email_verified_at DATETIME NULL,
  terms_accepted_at DATETIME NULL,
  last_login_at    DATETIME NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. vehicle_types (created early: referenced by profiles)
-- ---------------------------------------------------------------------
CREATE TABLE vehicle_types (
  id          TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(20) NOT NULL,
  name        VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  UNIQUE KEY uq_vehicle_types_code (code)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. commuter_profiles
-- ---------------------------------------------------------------------
CREATE TABLE commuter_profiles (
  user_id           INT UNSIGNED PRIMARY KEY,
  contact_number    VARCHAR(20) NULL,
  preferred_contact ENUM('email','phone','none') NOT NULL DEFAULT 'email',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. driver_profiles
-- ---------------------------------------------------------------------
CREATE TABLE driver_profiles (
  user_id          INT UNSIGNED PRIMARY KEY,
  contact_number   VARCHAR(20) NULL,
  vehicle_type_id  TINYINT UNSIGNED NOT NULL,
  operator_name    VARCHAR(120) NULL,
  association_name VARCHAR(120) NULL,
  vehicle_details  VARCHAR(255) NULL,
  approval_status  ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  approval_reason  VARCHAR(255) NULL,
  reviewed_by      INT UNSIGNED NULL,
  reviewed_at      DATETIME NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_dp_approval (approval_status),
  CONSTRAINT fk_dp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_dp_vtype FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id),
  CONSTRAINT fk_dp_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. terminals
-- ---------------------------------------------------------------------
CREATE TABLE terminals (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name                VARCHAR(150) NOT NULL,
  address             VARCHAR(255) NOT NULL,
  barangay            VARCHAR(100) NULL,
  latitude            DECIMAL(10,7) NULL,
  longitude           DECIMAL(10,7) NULL,
  description         TEXT NULL,
  operating_hours     VARCHAR(120) NULL,
  status              ENUM('active','inactive','archived') NOT NULL DEFAULT 'active',
  verification_status ENUM('verified','unverified','demo') NOT NULL DEFAULT 'unverified',
  verified_at         DATE NULL,
  is_demo             TINYINT(1) NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_terminals_name (name),
  KEY idx_terminals_status (status),
  CONSTRAINT chk_terminal_lat CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)),
  CONSTRAINT chk_terminal_lng CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180))
) ENGINE=InnoDB;

-- Supported vehicle types per terminal (many-to-many)
CREATE TABLE terminal_vehicle_types (
  terminal_id     INT UNSIGNED NOT NULL,
  vehicle_type_id TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (terminal_id, vehicle_type_id),
  CONSTRAINT fk_tvt_terminal FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE CASCADE,
  CONSTRAINT fk_tvt_vtype FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. routes
-- ---------------------------------------------------------------------
CREATE TABLE routes (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code                VARCHAR(30)  NOT NULL,
  name                VARCHAR(150) NOT NULL,
  origin              VARCHAR(150) NOT NULL,
  destination         VARCHAR(150) NOT NULL,
  vehicle_type_id     TINYINT UNSIGNED NOT NULL,
  distance_km         DECIMAL(6,2) NULL,
  description         TEXT NULL,
  requires_transfer   TINYINT(1) NOT NULL DEFAULT 0,
  transfer_notes      VARCHAR(255) NULL,
  status              ENUM('active','inactive','suspended','archived') NOT NULL DEFAULT 'active',
  verification_status ENUM('verified','unverified','demo') NOT NULL DEFAULT 'unverified',
  verified_at         DATE NULL,
  is_demo             TINYINT(1) NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_routes_code (code),
  KEY idx_routes_type_status (vehicle_type_id, status),
  KEY idx_routes_origin (origin),
  KEY idx_routes_destination (destination),
  CONSTRAINT fk_routes_vtype FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. route_stops (ordered)
-- ---------------------------------------------------------------------
CREATE TABLE route_stops (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  route_id     INT UNSIGNED NOT NULL,
  stop_order   SMALLINT UNSIGNED NOT NULL,
  name         VARCHAR(150) NOT NULL,
  terminal_id  INT UNSIGNED NULL,
  latitude     DECIMAL(10,7) NULL,
  longitude    DECIMAL(10,7) NULL,
  is_boarding  TINYINT(1) NOT NULL DEFAULT 1,
  is_dropoff   TINYINT(1) NOT NULL DEFAULT 1,
  notes        VARCHAR(255) NULL,
  UNIQUE KEY uq_route_stop_order (route_id, stop_order),
  KEY idx_route_stops_name (name),
  CONSTRAINT fk_rs_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  CONSTRAINT fk_rs_terminal FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. route_terminals
-- ---------------------------------------------------------------------
CREATE TABLE route_terminals (
  route_id    INT UNSIGNED NOT NULL,
  terminal_id INT UNSIGNED NOT NULL,
  role        ENUM('origin','destination','intermediate') NOT NULL DEFAULT 'intermediate',
  PRIMARY KEY (route_id, terminal_id),
  KEY idx_rt_terminal (terminal_id),
  CONSTRAINT fk_rt_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  CONSTRAINT fk_rt_terminal FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 10. fares (history preserved; is_current marks the published one)
-- ---------------------------------------------------------------------
CREATE TABLE fares (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  route_id            INT UNSIGNED NOT NULL,
  passenger_category  ENUM('regular','student','senior_pwd') NOT NULL DEFAULT 'regular',
  fare_type           ENUM('fixed','range','requires_confirmation') NOT NULL,
  amount_min          DECIMAL(8,2) NULL,
  amount_max          DECIMAL(8,2) NULL,
  effective_date      DATE NULL,
  source              VARCHAR(255) NULL,
  verification_status ENUM('verified','unverified','demo') NOT NULL DEFAULT 'unverified',
  verified_at         DATE NULL,
  is_current          TINYINT(1) NOT NULL DEFAULT 1,
  notes               VARCHAR(255) NULL,
  created_by          INT UNSIGNED NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_fares_route_current (route_id, is_current),
  CONSTRAINT fk_fares_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  CONSTRAINT fk_fares_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_fare_amounts CHECK (
    (amount_min IS NULL OR amount_min >= 0) AND
    (amount_max IS NULL OR amount_max >= 0) AND
    (amount_min IS NULL OR amount_max IS NULL OR amount_max >= amount_min))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. vehicles
-- ---------------------------------------------------------------------
CREATE TABLE vehicles (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  identifier      VARCHAR(40) NOT NULL COMMENT 'Plate number or body number',
  vehicle_type_id TINYINT UNSIGNED NOT NULL,
  description     VARCHAR(255) NULL,
  capacity        SMALLINT UNSIGNED NULL,
  color           VARCHAR(40) NULL,
  status          ENUM('active','inactive','suspended','archived') NOT NULL DEFAULT 'active',
  is_demo         TINYINT(1) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vehicles_identifier (identifier),
  KEY idx_vehicles_type_status (vehicle_type_id, status),
  CONSTRAINT fk_vehicles_vtype FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 11. vehicle_assignments (history retained via is_active/end_date)
-- ---------------------------------------------------------------------
CREATE TABLE vehicle_assignments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  driver_id   INT UNSIGNED NOT NULL,
  vehicle_id  INT UNSIGNED NOT NULL,
  route_id    INT UNSIGNED NULL,
  terminal_id INT UNSIGNED NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  assigned_by INT UNSIGNED NULL,
  notes       VARCHAR(255) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_va_driver_active (driver_id, is_active),
  KEY idx_va_vehicle_active (vehicle_id, is_active),
  KEY idx_va_route (route_id),
  CONSTRAINT fk_va_driver FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_va_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  CONSTRAINT fk_va_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
  CONSTRAINT fk_va_terminal FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE SET NULL,
  CONSTRAINT fk_va_assigner FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 12. vehicle_availability_reports (driver-reported, NOT GPS)
-- ---------------------------------------------------------------------
CREATE TABLE vehicle_availability_reports (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vehicle_id  INT UNSIGNED NOT NULL,
  driver_id   INT UNSIGNED NOT NULL,
  terminal_id INT UNSIGNED NULL,
  status      ENUM('available','unavailable','temporarily_suspended') NOT NULL,
  note        VARCHAR(255) NULL,
  reported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_var_vehicle_time (vehicle_id, reported_at),
  KEY idx_var_time (reported_at),
  CONSTRAINT fk_var_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  CONSTRAINT fk_var_driver FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_var_terminal FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 13. driver_update_requests
-- ---------------------------------------------------------------------
CREATE TABLE driver_update_requests (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  driver_id        INT UNSIGNED NOT NULL,
  entity_type      ENUM('route','fare','terminal','vehicle','other') NOT NULL,
  entity_id        INT UNSIGNED NULL,
  title            VARCHAR(150) NOT NULL,
  proposed_changes TEXT NOT NULL,
  reason           VARCHAR(500) NULL,
  status           ENUM('pending','approved','rejected','correction_requested') NOT NULL DEFAULT 'pending',
  reviewer_id      INT UNSIGNED NULL,
  review_notes     VARCHAR(500) NULL,
  reviewed_at      DATETIME NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_dur_status (status),
  KEY idx_dur_driver (driver_id),
  CONSTRAINT fk_dur_driver FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_dur_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 14. road_obstruction_reports
-- ---------------------------------------------------------------------
CREATE TABLE road_obstruction_reports (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title               VARCHAR(150) NOT NULL,
  location_description VARCHAR(255) NOT NULL,
  latitude            DECIMAL(10,7) NULL,
  longitude           DECIMAL(10,7) NULL,
  description         TEXT NOT NULL,
  affected_route_id   INT UNSIGNED NULL,
  reported_by         INT UNSIGNED NULL,
  reported_at         DATETIME NOT NULL,
  verification_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  resolution_status   ENUM('active','resolved') NOT NULL DEFAULT 'active',
  is_published        TINYINT(1) NOT NULL DEFAULT 0,
  admin_notes         TEXT NULL,
  reviewed_by         INT UNSIGNED NULL,
  is_demo             TINYINT(1) NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_ror_public (is_published, verification_status, resolution_status),
  KEY idx_ror_route (affected_route_id),
  CONSTRAINT fk_ror_route FOREIGN KEY (affected_route_id) REFERENCES routes(id) ON DELETE SET NULL,
  CONSTRAINT fk_ror_reporter FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_ror_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 15. route_alternatives (documented)
-- ---------------------------------------------------------------------
CREATE TABLE route_alternatives (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  route_id             INT UNSIGNED NOT NULL,
  alternative_route_id INT UNSIGNED NOT NULL,
  notes                VARCHAR(255) NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_route_alt (route_id, alternative_route_id),
  CONSTRAINT fk_ra_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  CONSTRAINT fk_ra_alt FOREIGN KEY (alternative_route_id) REFERENCES routes(id) ON DELETE CASCADE,
  CONSTRAINT chk_ra_not_self CHECK (route_id <> alternative_route_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 16. driver_reports (passenger complaints — PRIVATE)
-- ---------------------------------------------------------------------
CREATE TABLE driver_reports (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference_no       VARCHAR(24) NOT NULL,
  commuter_id        INT UNSIGNED NOT NULL,
  vehicle_type_id    TINYINT UNSIGNED NOT NULL,
  vehicle_identifier VARCHAR(60) NULL COMMENT 'As typed by commuter (plate/body no.)',
  driver_identifier  VARCHAR(120) NULL COMMENT 'Driver name/description as typed by commuter',
  vehicle_id         INT UNSIGNED NULL COMMENT 'Association established by admin or page context',
  driver_id          INT UNSIGNED NULL COMMENT 'Association established by admin only',
  route_id           INT UNSIGNED NULL,
  terminal_id        INT UNSIGNED NULL,
  incident_date      DATE NOT NULL,
  incident_time      TIME NULL,
  category           ENUM('scam_fraud','overcharging','misconduct_harassment','unsafe_driving',
                          'route_deviation','discrimination','other') NOT NULL,
  description        TEXT NOT NULL,
  preferred_contact  ENUM('email','phone','none') NOT NULL DEFAULT 'email',
  contact_detail     VARCHAR(120) NULL,
  status             ENUM('submitted','under_review','info_requested','resolved','closed','rejected')
                     NOT NULL DEFAULT 'submitted',
  assigned_admin_id  INT UNSIGNED NULL,
  admin_notes        TEXT NULL COMMENT 'PRIVATE: never returned to commuters or drivers',
  driver_response    TEXT NULL COMMENT 'Driver side, recorded by admin',
  resolution_summary TEXT NULL,
  rejection_reason   VARCHAR(500) NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_driver_reports_ref (reference_no),
  KEY idx_dr_commuter (commuter_id),
  KEY idx_dr_status (status),
  KEY idx_dr_category (category),
  KEY idx_dr_created (created_at),
  CONSTRAINT fk_dr_commuter FOREIGN KEY (commuter_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_dr_vtype FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id),
  CONSTRAINT fk_dr_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
  CONSTRAINT fk_dr_driver FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_dr_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
  CONSTRAINT fk_dr_terminal FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE SET NULL,
  CONSTRAINT fk_dr_admin FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Complaint evidence files (stored outside the web root, served only to authorized users)
CREATE TABLE driver_report_evidence (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id     INT UNSIGNED NOT NULL,
  stored_name   VARCHAR(80) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(60) NOT NULL,
  size_bytes    INT UNSIGNED NOT NULL,
  uploaded_by   INT UNSIGNED NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_evidence_stored (stored_name),
  CONSTRAINT fk_ev_report FOREIGN KEY (report_id) REFERENCES driver_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_ev_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 17. driver_report_history
-- ---------------------------------------------------------------------
CREATE TABLE driver_report_history (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id   INT UNSIGNED NOT NULL,
  actor_id    INT UNSIGNED NULL,
  action      VARCHAR(60) NOT NULL,
  from_status VARCHAR(30) NULL,
  to_status   VARCHAR(30) NULL,
  note        TEXT NULL,
  is_internal TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = admin-only entry',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_drh_report (report_id, created_at),
  CONSTRAINT fk_drh_report FOREIGN KEY (report_id) REFERENCES driver_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_drh_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 18. notifications
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  type       VARCHAR(40) NOT NULL,
  title      VARCHAR(150) NOT NULL,
  message    VARCHAR(500) NOT NULL,
  link       VARCHAR(255) NULL,
  read_at    DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notif_user (user_id, read_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 19. audit_logs (no passwords/tokens stored)
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id    INT UNSIGNED NULL,
  action      VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NULL,
  entity_id   INT UNSIGNED NULL,
  details     TEXT NULL,
  ip_address  VARCHAR(45) NULL,
  user_agent  VARCHAR(255) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_action (action),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 20. password_reset_tokens (only SHA-256 hashes stored)
-- ---------------------------------------------------------------------
CREATE TABLE password_reset_tokens (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_prt_hash (token_hash),
  KEY idx_prt_user (user_id),
  CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 21. email_verification_tokens
-- ---------------------------------------------------------------------
CREATE TABLE email_verification_tokens (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_evt_hash (token_hash),
  KEY idx_evt_user (user_id),
  CONSTRAINT fk_evt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- Reference data (not demo data): supported vehicle categories
INSERT INTO vehicle_types (code, name, description) VALUES
 ('tricycle', 'Tricycle', 'Short-distance motorized tricycle service'),
 ('jeepney',  'Jeepney',  'Fixed-route public utility jeepney'),
 ('bus',      'Bus',      'Public utility bus service');
