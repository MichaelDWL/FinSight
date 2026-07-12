const { Router } = require("express");

const controller = require("./movements.controller");
const validate = require("../../middlewares/validate");
const { createMovement, idParam, updateMovement, payMovement } = require("./movements.validator");

const router = Router();

router.get("/transactions", controller.listTransactions);
router.get("/bills", controller.listBills);
router.get("/", controller.list);
router.post("/", validate(createMovement), controller.create);
router.put("/:id", validate(updateMovement), controller.update);
router.patch("/:id/paid", validate(payMovement), controller.markPaid);
router.delete("/:id", validate(idParam), controller.remove);

module.exports = router;
