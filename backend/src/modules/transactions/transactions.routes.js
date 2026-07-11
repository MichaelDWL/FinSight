const { Router } = require("express");

const controller = require("./transactions.controller");
const validate = require("../../middlewares/validate");
const { createTransaction, idParam, updateTransaction } = require("./transactions.validator");

const router = Router();

router.get("/", controller.list);
router.post("/", validate(createTransaction), controller.create);
router.put("/:id", validate(updateTransaction), controller.update);
router.delete("/:id", validate(idParam), controller.remove);

module.exports = router;
