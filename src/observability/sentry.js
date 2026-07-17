/**
 * Sentry stub — ativa apenas com SENTRY_DSN.
 * Preparado para @sentry/node sem acoplar o dominio.
 */
const env = require("../config/env");
const logger = require("../utils/logger");

let sentry = null;

function initSentry() {
  if (!env.sentryDsn) {
    return null;
  }

  try {
    // Dependencia opcional — instalar @sentry/node em producao se desejar.
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    sentry = require("@sentry/node");
    sentry.init({
      dsn: env.sentryDsn,
      environment: env.nodeEnv,
      tracesSampleRate: env.isProduction ? 0.1 : 1.0,
    });
    logger.info("Sentry inicializado");
    return sentry;
  } catch (error) {
    logger.warn("Sentry DSN definido mas @sentry/node nao instalado", {
      error: error.message,
    });
    return null;
  }
}

function captureException(error, context = {}) {
  if (sentry) {
    sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => scope.setExtra(key, value));
      sentry.captureException(error);
    });
  }
}

module.exports = { initSentry, captureException };
