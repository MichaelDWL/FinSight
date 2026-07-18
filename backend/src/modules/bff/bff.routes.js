const { Router } = require("express");
const controller = require("./bff.controller");
const validate = require("../../middlewares/validate.middleware");
const { idParam } = require("../accounts/accounts.validator");
const {
  bffLimiter,
  dashboardLimiter,
  investmentsLimiter,
  accountsLimiter,
  cardsLimiter,
  reportsLimiter,
} = require("../../middlewares/rate-limit.middleware");

/**
 * Rotas BFF — uma chamada HTTP por tela.
 * Rate limits por grupo (config/rateLimit.config.js).
 */
const router = Router();

router.use(bffLimiter);

router.get("/home", dashboardLimiter, controller.home);
router.get("/dashboard", dashboardLimiter, controller.dashboard);
router.get("/investments", investmentsLimiter, controller.investments);
router.get("/accounts", accountsLimiter, controller.accounts);
router.get("/cards", cardsLimiter, controller.cards);
router.get("/transactions", controller.transactions);
router.get("/reports", reportsLimiter, controller.reports);
router.get("/insights", dashboardLimiter, controller.insights);

router.get("/account-detail/:id", accountsLimiter, validate(idParam), controller.accountDetail);
router.get("/card-detail/:id", cardsLimiter, validate(idParam), controller.cardDetail);

module.exports = router;
