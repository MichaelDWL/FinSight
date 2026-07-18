const { Router } = require("express");

const controller = require("./auth.controller");
const validate = require("../../middlewares/validate.middleware");
const { authenticate } = require("../../middlewares/authenticate.middleware");
const { csrfProtection } = require("../../middlewares/csrf.middleware");
const {
  loginLimiter,
  loginSlowDown,
  registerLimiter,
  passwordResetLimiter,
  refreshLimiter,
} = require("../../middlewares/rate-limit.middleware");
const schemas = require("./auth.validator");

const router = Router();

router.post(
  "/register",
  registerLimiter,
  validate(schemas.register),
  controller.register
);

router.post(
  "/login",
  loginLimiter,
  loginSlowDown,
  validate(schemas.login),
  controller.login
);

router.post("/refresh", refreshLimiter, controller.refresh);

router.post("/logout", csrfProtection, controller.logout);

router.get("/me", authenticate, controller.me);

router.post(
  "/forgot-password",
  passwordResetLimiter,
  validate(schemas.forgotPassword),
  controller.forgotPassword
);

router.post(
  "/reset-password",
  passwordResetLimiter,
  validate(schemas.resetPassword),
  controller.resetPassword
);

router.post(
  "/verify-email",
  validate(schemas.verifyEmail),
  controller.verifyEmail
);

router.post(
  "/change-password",
  authenticate,
  csrfProtection,
  validate(schemas.changePassword),
  controller.changePassword
);

router.get("/sessions", authenticate, controller.listSessions);

router.delete(
  "/sessions/:sessionId",
  authenticate,
  csrfProtection,
  validate(schemas.sessionIdParam),
  controller.revokeSession
);

router.delete(
  "/sessions",
  authenticate,
  csrfProtection,
  controller.revokeAllSessions
);

module.exports = router;
