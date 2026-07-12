const pool = require("../../../database/pool");
const { buildCashflowQuery } = require("../queries/cashflow.query");
const { MONTHLY_FLOW_MONTHS } = require("../constants");

async function fetchCashflowDashboard(userId, period) {
  const { rows } = await pool.query(buildCashflowQuery(), [
    userId,
    period.startDate,
    period.endDate,
    period.compareStartDate,
    period.compareEndDate,
    MONTHLY_FLOW_MONTHS,
  ]);

  return rows[0]?.payload || {};
}

module.exports = { fetchCashflowDashboard };
