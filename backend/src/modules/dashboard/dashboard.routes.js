const { Router } = require("express");

const controller = require("./dashboard.controller");

const router = Router();

router.get("/", controller.show);

module.exports = router;
