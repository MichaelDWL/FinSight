const { Router } = require("express");

const controller = require("./goals.controller");
const validate = require("../../middlewares/validate");
const { createGoal, idParam, updateGoal } = require("./goals.validator");

const router = Router();

router.get("/", controller.list);
router.post("/", validate(createGoal), controller.create);
router.put("/:id", validate(updateGoal), controller.update);
router.delete("/:id", validate(idParam), controller.remove);

module.exports = router;
