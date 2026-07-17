const { Router } = require("express");
const controller = require("./bff.controller");

/**
 * Rotas BFF — uma chamada HTTP por tela.
 * GET listagens de dominio que conflitam sao removidas dos routers CRUD.
 */
const router = Router();

router.get("/home", controller.home);
router.get("/dashboard", controller.dashboard);
router.get("/investments", controller.investments);
router.get("/accounts", controller.accounts);
router.get("/cards", controller.cards);
router.get("/transactions", controller.transactions);
router.get("/reports", controller.reports);
router.get("/insights", controller.insights);

module.exports = router;
