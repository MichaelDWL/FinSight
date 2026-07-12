const pool = require("../../../database/pool");
const { buildExpensesQuery } = require("../queries/expenses.query");
const { MONTHLY_FLOW_MONTHS } = require("../constants");

async function fetchExpensesDashboard(userId, period) {
  const { rows } = await pool.query(buildExpensesQuery(), [
    userId,
    period.startDate,
    period.endDate,
    period.compareStartDate,
    period.compareEndDate,
    MONTHLY_FLOW_MONTHS,
  ]);

  return rows[0]?.payload || {};
}

module.exports = { fetchExpensesDashboard };
