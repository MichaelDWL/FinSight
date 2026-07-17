const { initCache } = require("../modules/analytics/analytics.cache");
const CacheService = require("../modules/bff/cache/cache.service");
const { promoteAllToRedis } = require("../middlewares/rateLimit/store");
const logger = require("../utils/logger");

let bootPromise = null;
let ready = false;

/**
 * Inicializacao idempotente e lazy (segura em serverless).
 * Nao roda migrations, listen ou node-cron.
 */
async function ensureReady() {
  if (ready) return;
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    const started = Date.now();
    await Promise.all([
      initCache(),
      CacheService.init(),
      promoteAllToRedis(),
    ]);
    require("../modules/personalization");
    ready = true;
    logger.info("Platform bootstrap concluido", {
      durationMs: Date.now() - started,
    });
  })().catch((error) => {
    bootPromise = null;
    ready = false;
    logger.error("Platform bootstrap falhou", { error: error.message });
    throw error;
  });

  return bootPromise;
}

function bootstrapMiddleware() {
  return async function platformBootstrap(req, res, next) {
    try {
      await ensureReady();
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function isReady() {
  return ready;
}

module.exports = {
  ensureReady,
  bootstrapMiddleware,
  isReady,
};
