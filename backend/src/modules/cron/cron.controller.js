const { success } = require("../../utils/apiResponse");
const asyncHandler = require("../../utils/asyncHandler");
const { runDailySync } = require("../market-data/market.sync.job");
const logger = require("../../utils/logger");

const market = asyncHandler(async (req, res) => {
  const forceRates = req.query.force !== "false";
  const forceAssets = req.query.forceAssets === "true";

  logger.info("Cron market disparado", {
    source: req.headers["x-vercel-cron"] ? "vercel-cron" : "http",
    forceRates,
    forceAssets,
  });

  const result = await runDailySync({ forceRates, forceAssets });
  return success(res, {
    message: result.ok ? "Market sync concluido." : "Market sync concluido com falhas.",
    data: result,
  });
});

module.exports = { market };
