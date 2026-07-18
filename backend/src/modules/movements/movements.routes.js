const { Router } = require("express");

const controller = require("./movements.controller");
const validate = require("../../middlewares/validate.middleware");
const { idempotency } = require("../../middlewares/idempotency.middleware");
const { paginate } = require("../../middlewares/paginate.middleware");
const { movementsLimiter } = require("../../middlewares/rate-limit.middleware");
const { createMovement, idParam, updateMovement, payMovement } = require("./movements.validator");

const router = Router();

router.use(movementsLimiter);

router.get(
  "/transactions",
  paginate({ resource: "movements", defaultSort: "date" }),
  controller.listTransactions
);
router.get(
  "/bills",
  paginate({ resource: "movements", defaultSort: "date" }),
  controller.listBills
);
router.get("/", paginate({ resource: "movements", defaultSort: "date" }), controller.list);
router.post("/", idempotency({ required: true }), validate(createMovement), controller.create);
router.put("/:id", validate(updateMovement), controller.update);
router.patch(
  "/:id/paid",
  idempotency({ required: false }),
  validate(payMovement),
  controller.markPaid
);
router.delete("/:id", validate(idParam), controller.remove);

module.exports = router;
