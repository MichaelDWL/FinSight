const { Router } = require("express");

const controller = require("./bills.controller");
const validate = require("../../middlewares/validate");
const { createBill, idParam, payBill, updateBill } = require("./bills.validator");

const router = Router();

router.get("/", controller.list);
router.post("/", validate(createBill), controller.create);
router.put("/:id", validate(updateBill), controller.update);
router.patch("/:id/paid", validate(payBill), controller.markPaid);
router.delete("/:id", validate(idParam), controller.remove);

module.exports = router;
