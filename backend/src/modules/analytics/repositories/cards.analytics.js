const pool = require("../../../database/pool");
const { buildCardsQuery } = require("../queries/cards.query");
const { MONTHLY_FLOW_MONTHS } = require("../constants");

async function fetchCardsDashboard(userId, period) {
  const { rows } = await pool.query(buildCardsQuery(), [
    userId,
    period.startDate,
    period.endDate,
    period.compareStartDate,
    period.compareEndDate,
    MONTHLY_FLOW_MONTHS,
  ]);

  return rows[0]?.payload || {};
}

module.exports = { fetchCardsDashboard };
