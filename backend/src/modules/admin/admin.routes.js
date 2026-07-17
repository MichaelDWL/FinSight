const { Router } = require("express");

const controller = require("./admin.controller");
const validate = require("../../middlewares/validate");
const { authenticate, requireAdmin } = require("../../middlewares/authenticate");
const { csrfProtection } = require("../../middlewares/csrf");
const { adminLimiter } = require("../../middlewares/rateLimiters");
const schemas = require("./admin.validator");

const router = Router();

router.use(adminLimiter);
router.use(authenticate);
router.use(requireAdmin());

router.get("/users", validate(schemas.listUsers), controller.listUsers);
router.get("/users/:userId", validate(schemas.userIdParam), controller.getUser);
router.patch(
  "/users/:userId",
  csrfProtection,
  validate(schemas.updateUser),
  controller.updateUser
);
router.patch(
  "/users/:userId/role",
  csrfProtection,
  validate(schemas.changeRole),
  controller.changeRole
);
router.post(
  "/users/:userId/suspend",
  csrfProtection,
  validate(schemas.suspendUser),
  controller.suspendUser
);
router.post(
  "/users/:userId/reactivate",
  csrfProtection,
  validate(schemas.userIdParam),
  controller.reactivateUser
);
router.post(
  "/users/:userId/force-logout",
  csrfProtection,
  validate(schemas.userIdParam),
  controller.forceLogout
);
router.post(
  "/users/:userId/reset-password",
  csrfProtection,
  validate(schemas.userIdParam),
  controller.resetPassword
);
router.delete(
  "/users/:userId",
  csrfProtection,
  validate(schemas.userIdParam),
  controller.deleteUser
);
router.get(
  "/users/:userId/audit-logs",
  validate(schemas.userIdParam),
  controller.userAuditLogs
);
router.get("/audit-logs", validate(schemas.auditQuery), controller.listAuditLogs);

module.exports = router;
