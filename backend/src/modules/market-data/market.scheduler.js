const cron = require("node-cron");
const logger = require("../../utils/logger");
const env = require("../../config/env");
const { isServerless } = require("../../platform/runtime");
const { runDailySync } = require("./market.sync.job");
const rateService = require("./rate.service");
const marketService = require("./market.service");
const { syncMarkedPositions } = require("../investments/markToMarket.service");

let started = false;
const jobs = [];

async function runSafe(label, fn) {
  const startedAt = Date.now();
  try {
    logger.info(`MarketScheduler: iniciando ${label}`);
    const result = await fn();
    logger.info(`MarketScheduler: concluido ${label}`, {
      durationMs: Date.now() - startedAt,
      summary: summarize(result),
    });
    return result;
  } catch (error) {
    logger.error(`MarketScheduler: falha em ${label}`, { error: error.message });
    return null;
  }
}

function summarize(result) {
  if (!result || typeof result !== "object") return result;
  if ("updated" in result && "failed" in result) {
    return {
      total: result.total,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
    };
  }
  if ("positions" in result || ("updated" in result && "users" in result)) {
    return { updated: result.updated, users: result.users };
  }
  return {
    selic: result.selic?.failed ? "failed" : result.selic?.skipped ? "skipped" : "ok",
    cdi: result.cdi?.failed ? "failed" : result.cdi?.skipped ? "skipped" : "ok",
    fx: result.fx?.failed ? "failed" : result.fx?.skipped ? "skipped" : "ok",
    ipca: result.ipca?.failed ? "failed" : result.ipca?.skipped ? "skipped" : "ok",
  };
}

function schedule(expression, label, fn) {
  const job = cron.schedule(expression, () => {
    runSafe(label, fn);
  });
  jobs.push(job);
  return job;
}

async function refreshAssetsAndMark() {
  const refresh = await marketService.refreshWatchlist({ force: false });
  const marked = await syncMarkedPositions();
  return { refresh, marked };
}

async function bootstrapRefresh() {
  await runSafe("bootstrap-rates", () => rateService.refreshDailyIndicators({ force: false }));
  await runSafe("bootstrap-assets", () => marketService.refreshWatchlist({ force: false }));
  await runSafe("bootstrap-mark-to-market", () => syncMarkedPositions());
}

function startMarketScheduler() {
  if (started) return;
  if (isServerless) {
    logger.info("MarketScheduler ignorado em serverless — use /api/cron/market");
    return;
  }
  if (!env.marketSchedulerEnabled) {
    logger.info("MarketScheduler desabilitado via configuracao");
    return;
  }

  started = true;

  // MVP: um job diario alinhado ao fluxo BCB → BRAPI → Postgres
  schedule("0 3 * * *", "daily-market-sync", () => runDailySync({ forceRates: true }));
  // Compat: refresh horario de ativos (respeita TTL/cache dos providers)
  schedule("0 * * * *", "assets-and-mtm-hourly", () => refreshAssetsAndMark());

  logger.info("MarketScheduler iniciado (long-running)");

  setImmediate(() => {
    bootstrapRefresh().catch((error) => {
      logger.error("MarketScheduler bootstrap falhou", { error: error.message });
    });
  });
}

function stopMarketScheduler() {
  jobs.forEach((job) => job.stop());
  jobs.length = 0;
  started = false;
}

module.exports = {
  bootstrapRefresh,
  startMarketScheduler,
  stopMarketScheduler,
  runDailySync: require("./market.sync.job").runDailySync,
};
