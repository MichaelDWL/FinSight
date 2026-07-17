const { round2 } = require("./financialHealth.engine");

function parseDate(value) {
  return new Date(`${String(value).slice(0, 10)}T00:00:00`);
}

function daysBetween(start, end) {
  const ms = end.getTime() - start.getTime();
  return Math.max(Math.round(ms / 86400000), 0);
}

function getMonthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function projectExpenseMonthEnd({ totalExpenses, startDate, endDate }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const effectiveEnd = today < end ? today : end;
  const daysElapsed = Math.max(daysBetween(start, effectiveEnd) + 1, 1);
  const avgDaily = Number(totalExpenses) / daysElapsed;

  const monthEnd = getMonthEnd(end);
  const projectionEnd = today <= monthEnd ? monthEnd : end;
  const daysRemaining = today <= projectionEnd ? daysBetween(today, projectionEnd) : 0;

  const projected = Number(totalExpenses) + avgDaily * daysRemaining;

  return {
    avgDaily: round2(avgDaily),
    daysElapsed,
    daysRemaining,
    projectedTotal: round2(projected),
    method: "media_diaria_linear",
  };
}

function projectBalanceMonthEnd({
  currentBalance,
  totalIncome,
  totalExpenses,
  startDate,
  endDate,
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const effectiveEnd = today < end ? today : end;
  const daysElapsed = Math.max(daysBetween(start, effectiveEnd) + 1, 1);

  const avgDailyIncome = Number(totalIncome) / daysElapsed;
  const avgDailyExpense = Number(totalExpenses) / daysElapsed;
  const avgDailyNet = avgDailyIncome - avgDailyExpense;

  const monthEnd = getMonthEnd(end);
  const projectionEnd = today <= monthEnd ? monthEnd : end;
  const daysRemaining = today <= projectionEnd ? daysBetween(today, projectionEnd) : 0;

  const projectedBalance = Number(currentBalance) + avgDailyNet * daysRemaining;

  return {
    avgDailyIncome: round2(avgDailyIncome),
    avgDailyExpense: round2(avgDailyExpense),
    avgDailyNet: round2(avgDailyNet),
    daysElapsed,
    daysRemaining,
    projectedBalance: round2(projectedBalance),
    method: "saldo_atual_media_diaria",
  };
}

module.exports = { projectExpenseMonthEnd, projectBalanceMonthEnd };
