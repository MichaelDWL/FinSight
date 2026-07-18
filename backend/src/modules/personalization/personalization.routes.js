const { Router } = require("express");
const controller = require("./personalization.controller");
const validate = require("../../middlewares/validate.middleware");
const { updateProfile, completeOnboarding } = require("./personalization.validator");

const router = Router();

router.get("/context", controller.getContext);
router.get("/profile", controller.getProfile);
router.put("/profile", validate(updateProfile), controller.updateProfile);
router.post("/onboarding", validate(completeOnboarding), controller.completeOnboarding);
router.post("/refresh", controller.refresh);

module.exports = router;
