const { Router } = require("express");
const controller = require("./cron.controller");
const { verifyCronSecret } = require("../../middlewares/cronAuth");

const router = Router();

router.get("/market", verifyCronSecret, controller.market);
router.post("/market", verifyCronSecret, controller.market);

module.exports = router;
