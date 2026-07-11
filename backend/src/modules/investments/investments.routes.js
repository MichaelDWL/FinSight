const { Router } = require("express");

const controller = require("./investments.controller");
const validate = require("../../middlewares/validate");
const { createInvestment, idParam, updateInvestment } = require("./investments.validator");

const router = Router();

router.get("/", controller.list);
router.post("/", validate(createInvestment), controller.create);
router.put("/:id", validate(updateInvestment), controller.update);
router.delete("/:id", validate(idParam), controller.remove);

module.exports = router;
