const { Router } = require("express");

const controller = require("./cards.controller");
const validate = require("../../middlewares/validate.middleware");
const { cardsLimiter } = require("../../middlewares/rate-limit.middleware");
const { createCard, idParam, updateCard } = require("./cards.validator");

const router = Router();

router.use(cardsLimiter);

// GET /api/cards → BFF (modules/bff)
router.get("/:id", validate(idParam), controller.detail);
router.post("/", validate(createCard), controller.create);
router.put("/:id", validate(updateCard), controller.update);
router.delete("/:id", validate(idParam), controller.remove);

module.exports = router;
