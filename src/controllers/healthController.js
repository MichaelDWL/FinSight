const pool = require("../database/pool");
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/apiResponse");
const { cacheAdapter } = require("../modules/analytics/analytics.cache");

const getHealth = asyncHandler(async (_req, res) => {
  await pool.query("SELECT 1");

  return success(res, {
    message: "Servico saudavel.",
    data: {
      status: "ok",
      service: "finsight-backend",
      database: "connected",
      cache: cacheAdapter.getStatus(),
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = {
  getHealth,
};
