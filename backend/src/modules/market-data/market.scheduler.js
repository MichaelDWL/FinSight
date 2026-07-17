const cron = require("node-cron");
const logger = require("../../utils/logger");
const env = require("../../config/env");
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
  if (!env.marketSchedulerEnabled) {
    logger.info("MarketScheduler desabilitado via configuracao");
    return;
  }

  started = true;

  schedule("0 8 * * *", "daily-rates", () => rateService.refreshDailyIndicators({ force: true }));
  schedule("0 9 * * *", "daily-ipca-check", () => rateService.refreshIpca({ force: false }));
  // TTL de ativos = 24h; job horario respeita cache e so chama APIs quando necessario
  schedule("0 * * * *", "assets-and-mtm-hourly", () => refreshAssetsAndMark());

  logger.info("MarketScheduler iniciado");

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

module.exports = { bootstrapRefresh, startMarketScheduler, stopMarketScheduler };
