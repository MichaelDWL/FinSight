const app = require("./app");
const env = require("./config/env");
const { runMigrations } = require("./database/migrations");
const { initCache } = require("./modules/analytics/analytics.cache");
const logger = require("./utils/logger");

async function startServer() {
  await runMigrations();
  await initCache();

  const server = app.listen(env.port, () => {
    console.log(`FinSight API rodando na porta ${env.port}`);
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
  logger.error("Falha ao iniciar servidor", { error: error.message });
  process.exit(1);
});
