const { body, param, query } = require('express-validator');

const PASSWORD_RULE = { minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 };
const PASSWORD_MSG = 'Password must be at least 8 characters and include uppercase, lowercase and a number.';
const COMPLAINT_CATEGORIES = ['scam_fraud', 'overcharging', 'misconduct_harassment', 'unsafe_driving',
  'route_deviation', 'discrimination', 'other'];
const VEHICLE_TYPES = ['tricycle', 'jeepney', 'bus'];

const idParam = (name = 'id') => param(name).isInt({ min: 1 }).withMessage('Invalid identifier.').toInt();
const optInt = (field) => body(field).optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Invalid value.').toInt();
const optText = (field, max) => body(field).optional({ values: 'null' }).isString().trim().isLength({ max })
  .withMessage(`Must be at most ${max} characters.`);
const reqText = (field, label, max, min = 1) => body(field).isString().withMessage(`${label} is required.`).trim()
  .isLength({ min, max }).withMessage(min > 1 ? `${label} must be ${min}–${max} characters.` : `${label} is required (max ${max} characters).`);
const optDate = (field) => body(field).optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Use a valid date (YYYY-MM-DD).');
const optBool = (field) => body(field).optional().isBoolean().withMessage('Must be true or false.').toBoolean();
const optLat = (field) => body(field).optional({ values: 'null' }).isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90.').toFloat();
const optLng = (field) => body(field).optional({ values: 'null' }).isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180.').toFloat();

const passwordConfirm = (pwField, confirmField) => [
  body(pwField).isString().isStrongPassword(PASSWORD_RULE).withMessage(PASSWORD_MSG),
  body(confirmField).custom((v, { req }) => v === req.body[pwField]).withMessage('Passwords do not match.'),
];

const baseRegistration = [
  reqText('full_name', 'Full name', 120, 2),
  body('username').isString().trim().isLength({ min: 3, max: 40 }).withMessage('Username must be 3–40 characters.')
    .matches(/^[a-zA-Z0-9._-]+$/).withMessage('Username may contain letters, numbers, dots, dashes and underscores only.'),
  body('email').isString().trim().isEmail().withMessage('Enter a valid email address.').isLength({ max: 190 }).normalizeEmail({ gmail_remove_dots: false }),
  ...passwordConfirm('password', 'confirm_password'),
  body('accept_terms').custom((v) => v === true || v === 'true').withMessage('You must accept the Terms and Privacy Notice.'),
];

const phone = (field) => body(field).optional({ values: 'falsy' }).isString().trim()
  .matches(/^[0-9+()\-\s]{7,20}$/).withMessage('Enter a valid contact number.');

module.exports = {
  COMPLAINT_CATEGORIES,
  VEHICLE_TYPES,
  idParam,

  auth: {
    registerCommuter: [...baseRegistration, phone('contact_number')],
    registerDriver: [
      ...baseRegistration,
      phone('contact_number'),
      body('vehicle_type').isIn(VEHICLE_TYPES).withMessage('Select a transportation type.'),
      optText('operator_name', 120),
      optText('association_name', 120),
      optText('vehicle_details', 255),
    ],
    login: [
      body('identifier').isString().trim().notEmpty().withMessage('Enter your username or email.').isLength({ max: 190 }),
      body('password').isString().notEmpty().withMessage('Enter your password.').isLength({ max: 200 }),
    ],
    forgot: [body('email').isString().trim().isEmail().withMessage('Enter a valid email address.').normalizeEmail({ gmail_remove_dots: false })],
    reset: [body('token').isString().isLength({ min: 64, max: 64 }).withMessage('Invalid or expired reset link.'), ...passwordConfirm('password', 'confirm_password')],
    verify: [body('token').isString().isLength({ min: 64, max: 64 }).withMessage('Invalid or expired verification link.')],
    changePassword: [
      body('current_password').isString().notEmpty().withMessage('Enter your current password.'),
      ...passwordConfirm('new_password', 'confirm_password'),
    ],
  },

  profile: {
    commuter: [optText('full_name', 120).isLength({ min: 2 }), phone('contact_number'),
      body('preferred_contact').optional().isIn(['email', 'phone', 'none']).withMessage('Invalid contact preference.')],
    driver: [optText('full_name', 120).isLength({ min: 2 }), phone('contact_number'), optText('operator_name', 120), optText('association_name', 120)],
  },

  complaint: {
    create: [
      body('vehicle_type').isIn(VEHICLE_TYPES).withMessage('Select the transportation type.'),
      optText('vehicle_identifier', 60),
      optText('driver_identifier', 120),
      optInt('vehicle_id'), optInt('route_id'), optInt('terminal_id'),
      body('incident_date').isISO8601({ strict: true }).withMessage('Enter the incident date.')
        .custom((v) => new Date(v) <= new Date(Date.now() + 24 * 3600 * 1000)).withMessage('Incident date cannot be in the future.')
        .custom((v) => new Date(v) >= new Date(Date.now() - 366 * 24 * 3600 * 1000)).withMessage('Incident must be within the past year.'),
      body('incident_time').optional({ values: 'falsy' }).matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).withMessage('Enter a valid time (HH:MM).'),
      body('category').isIn(COMPLAINT_CATEGORIES).withMessage('Select a complaint category.'),
      reqText('description', 'Description', 3000, 20),
      body('preferred_contact').optional().isIn(['email', 'phone', 'none']).withMessage('Invalid contact preference.'),
      optText('contact_detail', 120),
    ],
    respond: [idParam(), reqText('message', 'Message', 2000, 5)],
    adminUpdate: [
      idParam(),
      body('status').optional().isIn(['submitted', 'under_review', 'info_requested', 'resolved', 'closed', 'rejected']).withMessage('Invalid status.'),
      optText('public_note', 2000), optText('admin_notes', 5000), optText('resolution_summary', 3000),
      optText('rejection_reason', 500), optText('driver_response', 3000),
      body('assigned_admin_id').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
      body('vehicle_id').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
      body('driver_id').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
    ],
  },

  driver: {
    availability: [
      body('vehicle_id').isInt({ min: 1 }).withMessage('Select a vehicle.').toInt(),
      body('status').isIn(['available', 'unavailable', 'temporarily_suspended']).withMessage('Select a status.'),
      optInt('terminal_id'), optText('note', 255),
    ],
    vehicleUpdate: [idParam(), optText('description', 255), optText('color', 40),
      body('capacity').optional({ values: 'null' }).isInt({ min: 1, max: 120 }).withMessage('Capacity must be 1–120.').toInt()],
    updateRequest: [
      body('entity_type').isIn(['route', 'fare', 'terminal', 'vehicle', 'other']).withMessage('Select what the update is about.'),
      optInt('entity_id'),
      reqText('title', 'Title', 150, 5),
      reqText('proposed_changes', 'Proposed changes', 3000, 10),
      optText('reason', 500),
    ],
  },

  admin: {
    terminal: [
      reqText('name', 'Terminal name', 150, 3), reqText('address', 'Address', 255, 3), optText('barangay', 100),
      optLat('latitude'), optLng('longitude'), optText('description', 3000), optText('operating_hours', 120),
      body('status').optional().isIn(['active', 'inactive', 'archived']),
      body('verification_status').optional().isIn(['verified', 'unverified', 'demo']),
      optDate('verified_at'),
      body('vehicle_type_ids').optional().isArray().withMessage('Invalid vehicle types.'),
      body('vehicle_type_ids.*').isInt({ min: 1 }).toInt(),
    ],
    route: [
      body('code').isString().trim().isLength({ min: 2, max: 30 }).withMessage('Route code is required (max 30).')
        .matches(/^[A-Za-z0-9-]+$/).withMessage('Route code may contain letters, numbers and dashes only.'),
      reqText('name', 'Route name', 150, 3), reqText('origin', 'Origin', 150), reqText('destination', 'Destination', 150),
      body('vehicle_type_id').isInt({ min: 1 }).withMessage('Select a transportation type.').toInt(),
      body('distance_km').optional({ values: 'falsy' }).isFloat({ min: 0, max: 999 }).withMessage('Invalid distance.').toFloat(),
      optText('description', 3000), optBool('requires_transfer'), optText('transfer_notes', 255),
      body('status').optional().isIn(['active', 'inactive', 'suspended', 'archived']),
      body('verification_status').optional().isIn(['verified', 'unverified', 'demo']),
      optDate('verified_at'),
      body('stops').optional().isArray({ max: 100 }).withMessage('Stops must be a list.'),
      body('stops.*.name').isString().trim().isLength({ min: 1, max: 150 }).withMessage('Each stop needs a name.'),
      body('stops.*.terminal_id').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
      body('stops.*.latitude').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }).toFloat(),
      body('stops.*.longitude').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }).toFloat(),
      body('terminals').optional().isArray(),
      body('terminals.*.terminal_id').isInt({ min: 1 }).toInt(),
      body('terminals.*.role').isIn(['origin', 'destination', 'intermediate']),
      body('alternative_route_ids').optional().isArray(),
      body('alternative_route_ids.*').isInt({ min: 1 }).toInt(),
    ],
    fare: [
      body('route_id').isInt({ min: 1 }).withMessage('Select a route.').toInt(),
      body('passenger_category').optional().isIn(['regular', 'student', 'senior_pwd']),
      body('fare_type').isIn(['fixed', 'range', 'requires_confirmation']).withMessage('Select a fare type.'),
      body('amount_min').optional({ values: 'null' }).isFloat({ min: 0, max: 99999 }).toFloat(),
      body('amount_max').optional({ values: 'null' }).isFloat({ min: 0, max: 99999 }).toFloat(),
      body().custom((b) => {
        if (b.fare_type === 'fixed' && (b.amount_min === undefined || b.amount_min === null || b.amount_min === '')) throw new Error('A fixed fare needs an amount.');
        if (b.fare_type === 'range') {
          if (b.amount_min == null || b.amount_max == null || b.amount_min === '' || b.amount_max === '') throw new Error('A fare range needs minimum and maximum amounts.');
          if (Number(b.amount_max) < Number(b.amount_min)) throw new Error('Maximum fare must be greater than or equal to minimum fare.');
        }
        return true;
      }),
      optDate('effective_date'), optText('source', 255),
      body('verification_status').optional().isIn(['verified', 'unverified', 'demo']),
      optDate('verified_at'), optBool('is_current'), optText('notes', 255),
    ],
    vehicle: [
      body('identifier').isString().trim().isLength({ min: 2, max: 40 }).withMessage('Vehicle identifier is required.'),
      body('vehicle_type_id').isInt({ min: 1 }).withMessage('Select a vehicle type.').toInt(),
      optText('description', 255), optText('color', 40),
      body('capacity').optional({ values: 'null' }).isInt({ min: 1, max: 120 }).toInt(),
      body('status').optional().isIn(['active', 'inactive', 'suspended', 'archived']),
    ],
    assignment: [
      body('driver_id').isInt({ min: 1 }).withMessage('Select a driver.').toInt(),
      body('vehicle_id').isInt({ min: 1 }).withMessage('Select a vehicle.').toInt(),
      optInt('route_id'), optInt('terminal_id'),
      body('start_date').isISO8601({ strict: true }).withMessage('Enter a start date.'),
      optDate('end_date'), optText('notes', 255),
    ],
    decision: [idParam(), body('reason').optional({ values: 'falsy' }).isString().trim().isLength({ max: 255 })],
    userStatus: [idParam(), body('status').isIn(['active', 'suspended', 'inactive']).withMessage('Invalid status.'),
      body('reason').optional({ values: 'falsy' }).isString().trim().isLength({ max: 255 })],
    reviewUpdate: [idParam(), body('status').isIn(['approved', 'rejected', 'correction_requested']).withMessage('Invalid decision.'),
      optText('review_notes', 500)],
    obstruction: [
      reqText('title', 'Title', 150, 3), reqText('location_description', 'Location', 255, 3),
      optLat('latitude'), optLng('longitude'), reqText('description', 'Description', 3000, 5),
      optInt('affected_route_id'),
      body('reported_at').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid report time.'),
      body('verification_status').optional().isIn(['pending', 'verified', 'rejected']),
      body('resolution_status').optional().isIn(['active', 'resolved']),
      optBool('is_published'), optText('admin_notes', 3000),
    ],
  },
  query,
};
