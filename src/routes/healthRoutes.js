const { Router } = require("express");
const { getHealth, getLive, getReady } = require("../controllers/healthController");

const router = Router();

router.get("/", getHealth);
router.get("/live", getLive);
router.get("/ready", getReady);

module.exports = router;
