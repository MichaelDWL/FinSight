const { Router } = require("express");

const validate = require("../../middlewares/validate");
const controller = require("./dashboard.controller");
const { periodQuery } = require("./dashboard.validator");

const router = Router();

router.get("/general", validate(periodQuery), controller.general);
router.get("/expenses", validate(periodQuery), controller.expenses);
router.get("/cashflow", validate(periodQuery), controller.cashflow);
router.get("/cards", validate(periodQuery), controller.cards);
router.get("/investments", validate(periodQuery), controller.investments);
router.get("/", controller.show);

module.exports = router;
