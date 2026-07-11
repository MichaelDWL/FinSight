const { Router } = require("express");

const controller = require("./accounts.controller");
const validate = require("../../middlewares/validate");
const { createAccount, idParam, updateAccount } = require("./accounts.validator");

const router = Router();

router.get("/", controller.list);
router.post("/", validate(createAccount), controller.create);
router.put("/:id", validate(updateAccount), controller.update);
router.delete("/:id", validate(idParam), controller.remove);

module.exports = router;
