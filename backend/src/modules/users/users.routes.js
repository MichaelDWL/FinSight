const { Router } = require("express");

const controller = require("./users.controller");
const validate = require("../../middlewares/validate");
const { updateUser } = require("./users.validator");

const router = Router();

router.get("/me", controller.profile);
router.put("/me", validate(updateUser), controller.update);

module.exports = router;
