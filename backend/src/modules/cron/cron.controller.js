const { success } = require("../../utils/apiResponse");
const asyncHandler = require("../../utils/asyncHandler");
const { runDailySync } = require("../market-data/market.sync.job");
const recurrenceService = require("../../services/recurrence.service");
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

const recurrences = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 200;

  logger.info("Cron recurrences disparado", {
    source: req.headers["x-vercel-cron"] ? "vercel-cron" : "http",
    limit,
  });

  const result = await recurrenceService.syncAllDueRecurrences({ limit });
  return success(res, {
    message: result.ok
      ? "Recorrencias sincronizadas."
      : "Recorrencias sincronizadas com falhas parciais.",
    data: result,
  });
});

module.exports = { market, recurrences };
