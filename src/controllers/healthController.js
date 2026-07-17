const pool = require("../database/pool");
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/apiResponse");
const { cacheAdapter } = require("../modules/analytics/analytics.cache");
const sharedRedis = require("../platform/redis");
const { isReady: bootstrapReady } = require("../platform/bootstrap");
const AppError = require("../utils/AppError");

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
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    throw new AppError("Database indisponivel.", 503, { error: error.message });
  }

  return success(res, {
    message: "Ready.",
    data: {
      status: "ok",
      database: "connected",
      bootstrap: bootstrapReady(),
      redis: sharedRedis.isReady() ? "connected" : "optional-absent",
      cache: cacheAdapter.getStatus(),
      timestamp: new Date().toISOString(),
    },
  });
});

/** Health completo (compat). */
const getHealth = asyncHandler(async (_req, res) => {
  await pool.query("SELECT 1");

  return success(res, {
    message: "Servico saudavel.",
    data: {
      status: "ok",
      service: "finsight-backend",
      database: "connected",
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
