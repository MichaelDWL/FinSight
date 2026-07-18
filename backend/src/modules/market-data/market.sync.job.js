/**
 * Job puro de sincronizacao de mercado.
 * Sem Express, sem Vercel, sem node-cron — apenas parametros in / objetos out.
 * Orquestrado por: Vercel Cron, crontab externo, ou scheduler long-running.
 */

const logger = require("../../utils/logger");
const env = require("../../config/env");
const pool = require("../../database/pool");
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
 * Remove historico antigo conforme retencao + limpa idempotency expirada.
 */
async function purgeExpiredMarketData() {
  const days = env.marketDataRetentionDays;
  if (!days || days <= 0) {
    return { skipped: true, reason: "retention disabled" };
  }

  let deleted = 0;
  const hist = await pool
    .query(
      `DELETE FROM market_data_history
        WHERE created_at < now() - ($1 || ' days')::interval`,
      [String(days)]
    )
    .catch(() => null);
  if (hist) deleted += hist.rowCount || 0;

  const rates = await pool
    .query(
      `DELETE FROM economic_rates_history
        WHERE created_at < now() - ($1 || ' days')::interval`,
      [String(days)]
    )
    .catch(() => null);
  if (rates) deleted += rates.rowCount || 0;

  await pool.query(`DELETE FROM idempotency_keys WHERE expires_at < now()`).catch(() => null);

  return { deleted, retentionDays: days };
}

/**
 * Fluxo diario (MVP): BCB → BRAPI/watchlist → mark-to-market → retencao → encerrar.
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
  steps.push(await runSafe("mark-to-market", () => syncMarkedPositions()));
  steps.push(await runSafe("retention-purge", () => purgeExpiredMarketData()));

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
  purgeExpiredMarketData,
};
