const { Router } = require("express");

const controller = require("./investments.controller");
const validate = require("../../middlewares/validate.middleware");
const { paginate } = require("../../middlewares/paginate.middleware");
const { investmentsLimiter } = require("../../middlewares/rate-limit.middleware");
const {
  createInvestment,
  idParam,
  projectInvestment,
  updateInvestment,
} = require("./investments.validator");

const router = Router();

router.use(investmentsLimiter);

// GET /api/investments → BFF (modules/bff)
router.get(
  "/detailed",
  paginate({ resource: "investments", defaultSort: "date" }),
  controller.listDetailed
);
router.get("/portfolio/summary", controller.portfolio);
router.post("/simulate", validate(projectInvestment), controller.simulate);
router.get("/:id", validate(idParam), controller.detail);
router.post("/", validate(createInvestment), controller.create);
router.put("/:id", validate(updateInvestment), controller.update);
router.delete("/:id", validate(idParam), controller.remove);

module.exports = router;
