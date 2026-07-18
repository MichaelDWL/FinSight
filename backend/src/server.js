const env = require("./config/env");
const { runMigrations } = require("./database/migrations");
const { ensureReady } = require("./platform/bootstrap");
const { isLongRunning, isServerless, runtime } = require("./platform/runtime");
const { startMarketScheduler } = require("./modules/market-data/market.scheduler");
const logger = require("./utils/logger");

async function startServer() {
  if (isServerless) {
    logger.warn("server.js nao deve ser usado em runtime serverless", { runtime });
    return;
  }

  await runMigrations();
  await ensureReady();

  // node-cron apenas em processo longo; em serverless use /api/cron/market
  if (isLongRunning && env.marketSchedulerEnabled) {
    startMarketScheduler();
  } else {
    logger.info("MarketScheduler in-process desabilitado", {
      runtime,
      marketSchedulerEnabled: env.marketSchedulerEnabled,
    });
  }

  const app = require("./app");
  const server = app.listen(env.port, () => {
    console.log(`FinSight API rodando na porta ${env.port} [${runtime}]`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`\nPorta ${env.port} ja esta em uso.`);
      console.error(`A API provavelmente ja esta rodando: http://localhost:${env.port}/health`);
      console.error("Para reiniciar, use: npm run restart\n");
      process.exit(1);
    }

    throw error;
  });
}

startServer().catch((error) => {
  // AggregateError (ex.: ECONNREFUSED do pool) tem message vazio; extrai detalhe util.
  const detail =
    error?.message ||
    error?.code ||
    (Array.isArray(error?.errors)
      ? error.errors.map((e) => `${e.code || e.name}: ${e.message || `${e.address}:${e.port}`}`).join("; ")
      : String(error));
  logger.error("Falha ao iniciar servidor", { error: detail, code: error?.code });
  process.exit(1);
});
