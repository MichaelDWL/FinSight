const app = require("./app");
const env = require("./config/env");
const { runMigrations } = require("./database/migrations");
const logger = require("./utils/logger");

async function startServer() {
  await runMigrations();

  app.listen(env.port, () => {
    console.log(`FinSight API rodando na porta ${env.port}`);
  });
}

startServer().catch((error) => {
  logger.error("Falha ao iniciar servidor", { error: error.message });
  process.exit(1);
});
