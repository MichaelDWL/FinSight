const pool = require("../../../database/pool");
const { buildInvestmentsQuery } = require("../queries/investments.query");
const { MONTHLY_FLOW_MONTHS } = require("../constants");
const { ensureCurrentSnapshot } = require("../services/snapshotService");

async function fetchInvestmentsDashboard(userId, period) {
  await ensureCurrentSnapshot(userId);

  const { rows } = await pool.query(buildInvestmentsQuery(), [
    userId,
    period.startDate,
    period.endDate,
    period.compareStartDate,
    period.compareEndDate,
    MONTHLY_FLOW_MONTHS,
  ]);

  return rows[0]?.payload || {};
}

module.exports = { fetchInvestmentsDashboard };
