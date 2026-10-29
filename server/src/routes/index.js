const express = require('express');
const v = require('../validators');
const { validate, rateLimiters, evidenceUpload } = require('../middleware/common');
const { authenticate, requireRole, requireActive, requireApprovedDriver } = require('../middleware/auth');

const auth = require('../controllers/auth.controller');
const pub = require('../controllers/public.controller');
const commuter = require('../controllers/commuter.controller');
const driver = require('../controllers/driver.controller');
const transport = require('../controllers/adminTransport.controller');
const people = require('../controllers/adminPeople.controller');
const reports = require('../controllers/adminReports.controller');
const notifications = require('../controllers/notification.controller');

const router = express.Router();

/* ------------------------------ Auth ------------------------------ */
const a = express.Router();
a.post('/register-commuter', rateLimiters.auth, v.auth.registerCommuter, validate, auth.registerCommuter);
a.post('/register-driver', rateLimiters.auth, v.auth.registerDriver, validate, auth.registerDriver);
a.post('/login', rateLimiters.auth, v.auth.login, validate, auth.login);
a.post('/logout', auth.logout);
a.get('/me', authenticate, auth.me);
a.post('/forgot-password', rateLimiters.passwordReset, v.auth.forgot, validate, auth.forgotPassword);
a.post('/reset-password', rateLimiters.passwordReset, v.auth.reset, validate, auth.resetPassword);
a.post('/verify-email', rateLimiters.auth, v.auth.verify, validate, auth.verifyEmail);
a.post('/resend-verification', authenticate, rateLimiters.passwordReset, auth.resendVerification);
a.patch('/password', authenticate, rateLimiters.auth, v.auth.changePassword, validate, auth.changePassword);
router.use('/auth', a);

/* ----------------------- Public (no login needed) ------------------ */
router.get('/overview', pub.overview);
router.get('/places', pub.places);
router.get('/vehicle-types', pub.vehicleTypes);
router.get('/terminals', pub.listTerminals);
router.get('/terminals/:id', v.idParam(), validate, pub.getTerminal);
router.get('/routes', pub.searchRoutes);
router.get('/routes/:id', v.idParam(), validate, pub.getRoute);
router.get('/routes/:id/alternatives', v.idParam(), validate, pub.routeAlternatives);
router.get('/fares', pub.listFares);
router.get('/availability', pub.listAvailability);
router.get('/road-obstructions', pub.listObstructions);

/* ------------------------- Notifications -------------------------- */
router.get('/notifications', authenticate, notifications.list);
router.patch('/notifications/:id/read', authenticate, v.idParam(), validate, notifications.markRead);
router.post('/notifications/read-all', authenticate, notifications.markAllRead);

/* ---------------------------- Commuter ---------------------------- */
const c = express.Router();
c.use(authenticate, requireRole('commuter'), requireActive);
c.get('/profile', commuter.getProfile);
c.patch('/profile', v.profile.commuter, validate, commuter.updateProfile);
c.get('/reports', commuter.listReports);
c.post('/reports', rateLimiters.complaint, evidenceUpload.array('evidence', 10), v.complaint.create, validate, commuter.createReport);
c.get('/reports/:id', v.idParam(), validate, commuter.getReport);
c.post('/reports/:id/responses', evidenceUpload.array('evidence', 10), v.complaint.respond, validate, commuter.respondToReport);
c.get('/reports/:id/evidence/:fileId', v.idParam(), v.idParam('fileId'), validate, commuter.downloadOwnEvidence);
router.use('/commuter', c);

/* ----------------------------- Driver ----------------------------- */
const d = express.Router();
d.use(authenticate, requireRole('driver'));
d.get('/profile', driver.getProfile);                       // allowed while pending approval
d.patch('/profile', v.profile.driver, validate, driver.updateProfile);
d.use(requireApprovedDriver);                               // everything below requires approval
d.get('/dashboard', driver.dashboard);
d.get('/assignments', driver.assignments);
d.get('/vehicles', driver.vehicles);
d.patch('/vehicles/:id', v.driver.vehicleUpdate, validate, driver.updateVehicle);
d.get('/availability', driver.availabilityHistory);
d.post('/availability', v.driver.availability, validate, driver.reportAvailability);
d.get('/update-requests', driver.listUpdateRequests);
d.post('/update-requests', v.driver.updateRequest, validate, driver.createUpdateRequest);
d.get('/options', driver.options);
router.use('/driver', d);

/* ------------------------- Administrator -------------------------- */
const ad = express.Router();
ad.use(authenticate, requireRole('admin'), requireActive);
ad.get('/dashboard', reports.dashboard);
ad.get('/options', transport.options);

ad.get('/terminals', transport.listTerminals);
ad.post('/terminals', v.admin.terminal, validate, transport.createTerminal);
ad.put('/terminals/:id', v.idParam(), v.admin.terminal, validate, transport.updateTerminal);
ad.patch('/terminals/:id/status', v.idParam(), validate, transport.setTerminalStatus);

ad.get('/routes', transport.listRoutes);
ad.get('/routes/:id', v.idParam(), validate, transport.getRoute);
ad.post('/routes', v.admin.route, validate, transport.createRoute);
ad.put('/routes/:id', v.idParam(), v.admin.route, validate, transport.updateRoute);
ad.patch('/routes/:id/status', v.idParam(), validate, transport.setRouteStatus);

ad.get('/fares', transport.listFares);
ad.post('/fares', v.admin.fare, validate, transport.createFare);
ad.put('/fares/:id', v.idParam(), v.admin.fare, validate, transport.updateFare);

ad.get('/vehicles', transport.listVehicles);
ad.post('/vehicles', v.admin.vehicle, validate, transport.createVehicle);
ad.put('/vehicles/:id', v.idParam(), v.admin.vehicle, validate, transport.updateVehicle);
ad.patch('/vehicles/:id/status', v.idParam(), validate, transport.setVehicleStatus);
ad.get('/vehicles/:id/availability', v.idParam(), validate, transport.vehicleAvailabilityHistory);

ad.get('/assignments', transport.listAssignments);
ad.post('/assignments', v.admin.assignment, validate, transport.createAssignment);
ad.patch('/assignments/:id/end', v.idParam(), validate, transport.endAssignment);

ad.get('/drivers', people.listDrivers);
ad.post('/drivers/:id/approve', v.admin.decision, validate, people.approveDriver);
ad.post('/drivers/:id/reject', v.admin.decision, validate, people.rejectDriver);
ad.get('/users', people.listUsers);
ad.patch('/users/:id/status', v.admin.userStatus, validate, people.setUserStatus);

ad.get('/update-requests', people.listUpdateRequests);
ad.patch('/update-requests/:id', v.admin.reviewUpdate, validate, people.reviewUpdateRequest);

ad.get('/reports', reports.listReports);
ad.get('/reports/:id', v.idParam(), validate, reports.getReport);
ad.patch('/reports/:id', v.complaint.adminUpdate, validate, reports.updateReport);
ad.get('/reports/:id/evidence/:fileId', v.idParam(), v.idParam('fileId'), validate, reports.downloadEvidence);

ad.get('/obstructions', reports.listObstructions);
ad.post('/obstructions', v.admin.obstruction, validate, reports.createObstruction);
ad.put('/obstructions/:id', v.idParam(), v.admin.obstruction, validate, reports.updateObstruction);

ad.get('/analytics', reports.listReportTypes);
ad.get('/analytics/:type', reports.runReport);
ad.get('/audit-logs', reports.listAuditLogs);
router.use('/admin', ad);

module.exports = router;
