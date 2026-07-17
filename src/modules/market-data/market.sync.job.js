/**
 * Job puro de sincronizacao de mercado.
 * Sem Express, sem Vercel, sem node-cron — apenas parametros in / objetos out.
 * Orquestrado por: Vercel Cron, crontab externo, ou scheduler long-running.
 */

const logger = require("../../utils/logger");
const rateService = require("./rate.service");
const marketService = require("./market.service");
const { syncMarkedPositions } = require("../investments/markToMarket.service");

async function runSafe(label, fn) {
  const startedAt = Date.now();
  try {
    logger.info(`MarketSyncJob: iniciando ${label}`);
    const result = await fn();
    logger.info(`MarketSyncJob: concluido ${label}`, {
      durationMs: Date.now() - startedAt,
    });
    return { ok: true, label, result, durationMs: Date.now() - startedAt };
  } catch (error) {
    logger.error(`MarketSyncJob: falha em ${label}`, { error: error.message });
    return { ok: false, label, error: error.message, durationMs: Date.now() - startedAt };
  }
}

/**
 * Fluxo diario (MVP): BCB → BRAPI/watchlist → mark-to-market → encerrar.
 * Nenhuma pagina deve chamar APIs externas; apenas este job.
 */
async function runDailySync({ forceRates = true, forceAssets = false } = {}) {
  const startedAt = Date.now();
  const steps = [];

  steps.push(
    await runSafe("daily-rates", () =>
      rateService.refreshDailyIndicators({ force: forceRates })
    )
  );
  steps.push(
    await runSafe("daily-ipca", () => rateService.refreshIpca({ force: false }))
  );
  steps.push(
    await runSafe("watchlist", () =>
      marketService.refreshWatchlist({ force: forceAssets })
    )
  );
  steps.push(
    await runSafe("mark-to-market", () => syncMarkedPositions())
  );

  const failed = steps.filter((s) => !s.ok);
  const summary = {
    ok: failed.length === 0,
    durationMs: Date.now() - startedAt,
    steps: steps.map(({ ok, label, durationMs, error }) => ({
      ok,
      label,
      durationMs,
      ...(error ? { error } : {}),
    })),
    failedCount: failed.length,
  };

  logger.info("MarketSyncJob: daily sync finalizado", summary);
  return summary;
}

module.exports = {
  runDailySync,
};
