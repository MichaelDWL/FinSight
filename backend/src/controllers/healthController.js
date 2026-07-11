const pool = require("../database/pool");
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/apiResponse");

const getHealth = asyncHandler(async (_req, res) => {
  await pool.query("SELECT 1");

  return success(res, {
    message: "Servico saudavel.",
    data: {
      status: "ok",
      service: "finsight-backend",
      database: "connected",
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = {
  getHealth,
};
