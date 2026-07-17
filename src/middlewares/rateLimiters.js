/**
 * Fachada de rate limiters — valores vem de config/rateLimit.config.js
 * via RateLimitService (sem magic numbers).
 */
const { rateLimitService } = require("../services/rateLimit/RateLimitService");

const globalApiLimiter = rateLimitService.global();
const loginLimiter = rateLimitService.forGroup("login");
const loginSlowDown = rateLimitService.loginSlowDown();
const registerLimiter = rateLimitService.forGroup("register");
const passwordResetLimiter = rateLimitService.forGroup("passwordReset");
const refreshLimiter = rateLimitService.forGroup("refresh");
const adminLimiter = rateLimitService.forGroup("admin");
const dashboardLimiter = rateLimitService.forGroup("dashboard");
const movementsLimiter = rateLimitService.forGroup("movements");
const investmentsLimiter = rateLimitService.forGroup("investments");
const marketLimiter = rateLimitService.forGroup("market");
const reportsLimiter = rateLimitService.forGroup("reports");
const privacyExportLimiter = rateLimitService.forGroup("privacyExport");
const bffLimiter = rateLimitService.forGroup("bff");
const accountsLimiter = rateLimitService.forGroup("accounts");
const cardsLimiter = rateLimitService.forGroup("cards");

module.exports = {
  createLimiter: (opts) => rateLimitService.createLimiter(opts),
  rateLimitService,
  globalApiLimiter,
  loginLimiter,
  loginSlowDown,
  registerLimiter,
  passwordResetLimiter,
  refreshLimiter,
  adminLimiter,
  dashboardLimiter,
  movementsLimiter,
  investmentsLimiter,
  marketLimiter,
  reportsLimiter,
  privacyExportLimiter,
  bffLimiter,
  accountsLimiter,
  cardsLimiter,
};
