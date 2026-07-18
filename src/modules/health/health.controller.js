const pool = require("../../database/pool");
const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const { cacheAdapter } = require("../analytics/analytics.cache");
const sharedRedis = require("../../platform/redis");
const { isReady: bootstrapReady } = require("../../platform/bootstrap");
const AppError = require("../../utils/AppError");

/** Liveness — processo vivo, sem deps. */
const getLive = asyncHandler(async (_req, res) => {
  return success(res, {
    message: "Alive.",
    data: {
      status: "ok",
      service: "finsight",
      timestamp: new Date().toISOString(),
    },
  });
});

/** Readiness — DB obrigatorio; Redis opcional. */
const getReady = asyncHandler(async (_req, res) => {
  const db = await pool.checkDatabaseConnection();
  if (db.status !== "ok") {
    throw new AppError("Database indisponivel.", 503, {
      code: db.code,
      error: db.message,
      hint: db.hint,
    });
  }

  return success(res, {
    message: "Ready.",
    data: {
      status: "ok",
      database: {
        status: "connected",
        responseTimeMs: db.responseTimeMs,
        version: db.postgresVersion,
        name: db.database,
        ssl: db.ssl,
      },
      bootstrap: bootstrapReady(),
      redis: sharedRedis.isReady() ? "connected" : "optional-absent",
      cache: cacheAdapter.getStatus(),
      timestamp: new Date().toISOString(),
    },
  });
});

/** Health completo (compat). */
const getHealth = asyncHandler(async (_req, res) => {
  const db = await pool.checkDatabaseConnection();
  if (db.status !== "ok") {
    throw new AppError("Database indisponivel.", 503, {
      code: db.code,
      error: db.message,
      hint: db.hint,
    });
  }

  return success(res, {
    message: "Servico saudavel.",
    data: {
      status: "ok",
      service: "finsight-backend",
      database: {
        status: "connected",
        responseTimeMs: db.responseTimeMs,
        version: db.postgresVersion,
        name: db.database,
        ssl: db.ssl,
      },
      bootstrap: bootstrapReady(),
      redis: sharedRedis.isReady(),
      cache: cacheAdapter.getStatus(),
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = {
  getHealth,
  getLive,
  getReady,
};
