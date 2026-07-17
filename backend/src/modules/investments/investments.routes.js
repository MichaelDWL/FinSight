const { Router } = require("express");

const controller = require("./investments.controller");
const validate = require("../../middlewares/validate");
const {
  createInvestment,
  idParam,
  projectInvestment,
  updateInvestment,
} = require("./investments.validator");

const router = Router();

router.get("/", controller.list);
router.get("/detailed", controller.listDetailed);
router.get("/portfolio/summary", controller.portfolio);
router.post("/simulate", validate(projectInvestment), controller.simulate);
router.get("/:id", validate(idParam), controller.detail);
router.post("/", validate(createInvestment), controller.create);
router.put("/:id", validate(updateInvestment), controller.update);
router.delete("/:id", validate(idParam), controller.remove);

module.exports = router;
