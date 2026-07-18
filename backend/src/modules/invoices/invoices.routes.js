const { Router } = require("express");

const controller = require("./invoices.controller");
const validate = require("../../middlewares/validate.middleware");
const { cardParam, idParam } = require("./invoices.validator");

const router = Router();

router.get("/current", controller.listCurrent);
router.get("/card/:cardId", validate(cardParam), controller.listByCard);
router.get("/:id/items", validate(idParam), controller.listItems);
router.post("/:id/pay", validate(idParam), controller.pay);

module.exports = router;
