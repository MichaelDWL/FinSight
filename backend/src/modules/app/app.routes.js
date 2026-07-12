const { Router } = require("express");

const controller = require("./app.controller");

const router = Router();

router.get("/bootstrap", controller.bootstrap);

module.exports = router;
