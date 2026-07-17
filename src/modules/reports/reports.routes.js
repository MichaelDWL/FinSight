const { Router } = require("express");

const controller = require("./reports.controller");

const router = Router();

router.get("/", controller.list);

module.exports = router;
