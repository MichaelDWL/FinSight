const { Router } = require("express");

const controller = require("./market.controller");
const validate = require("../../middlewares/validate");
const {
  assetCodeParam,
  historyQuery,
  listAssetsQuery,
  marketHistoryQuery,
  providersStatusQuery,
} = require("./market.validator");

const router = Router();

router.get("/overview", controller.overview);
router.get("/rates", controller.rates);
router.get("/rates/history", validate(historyQuery), controller.ratesHistory);
router.get("/history", validate(marketHistoryQuery), controller.history);
router.get("/assets", validate(listAssetsQuery), controller.listAssets);
router.get("/assets/:code", validate(assetCodeParam), controller.assetDetail);
router.get("/providers/status", validate(providersStatusQuery), controller.providersStatus);

module.exports = router;
