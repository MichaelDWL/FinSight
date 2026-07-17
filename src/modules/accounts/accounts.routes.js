const { Router } = require("express");

const controller = require("./accounts.controller");
const validate = require("../../middlewares/validate");
const { accountsLimiter } = require("../../middlewares/rateLimiters");
const { createAccount, idParam, updateAccount } = require("./accounts.validator");

const router = Router();

router.use(accountsLimiter);

// GET /api/accounts → BFF (modules/bff)
router.get("/:id", validate(idParam), controller.detail);
router.post("/", validate(createAccount), controller.create);
router.put("/:id", validate(updateAccount), controller.update);
router.delete("/:id", validate(idParam), controller.remove);

module.exports = router;
