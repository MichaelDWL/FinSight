const pool = require("../../../database/pool");
const { buildGeneralQuery, MONTHLY_FLOW_MONTHS } = require("../queries/shared.cte");

async function fetchGeneralDashboard(userId, period) {
  const query = buildGeneralQuery();
  const { rows } = await pool.query(query, [
    userId,
    period.startDate,
    period.endDate,
    period.compareStartDate,
    period.compareEndDate,
    MONTHLY_FLOW_MONTHS,
  ]);

  return rows[0]?.payload || {};
}

module.exports = { fetchGeneralDashboard };
