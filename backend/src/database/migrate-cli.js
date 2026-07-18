#!/usr/bin/env node
/**
 * CLI de migrations — use em CI/CD e deploy (nunca no request path serverless).
 * Uso: npm run migrate
 */
const logger = require("../utils/logger");

async function main() {
  const { runMigrations } = require("./migrations");
  const started = Date.now();
  logger.info("Iniciando migrations via CLI...");
  await runMigrations({ runSeed: process.env.ALLOW_ADMIN_SEED === "true" });
  logger.info("Migrations concluidas", { durationMs: Date.now() - started });
  process.exit(0);
}

main().catch((error) => {
  console.error("[migrate] falhou:", error.message);
  process.exit(1);
});
