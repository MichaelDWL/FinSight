const { Router } = require("express");
const controller = require("./privacy.controller");
const validate = require("../../middlewares/validate.middleware");
const { privacyExportLimiter } = require("../../middlewares/rate-limit.middleware");
const { consent } = require("./privacy.validator");

const router = Router();

router.get("/policy", controller.getPolicy);
router.get("/consents", controller.listConsents);
router.post("/consent", validate(consent), controller.consent);
router.get("/export", privacyExportLimiter, controller.exportData);
router.post("/delete-account", controller.deleteAccount);

module.exports = router;
