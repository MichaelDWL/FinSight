const { Router } = require("express");
const { getHealth, getLive, getReady } = require("./health.controller");

const router = Router();

router.get("/", getHealth);
router.get("/live", getLive);
router.get("/ready", getReady);

module.exports = router;
