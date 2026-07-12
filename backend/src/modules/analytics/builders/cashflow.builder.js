const { round2 } = require("../engines/financialHealth.engine");
const { projectBalanceMonthEnd } = require("../engines/projection.engine");

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [];
}

function buildCashflowDashboard(raw, period) {
  const currentBalance = Number(raw.currentBalance) || 0;
  const totals = raw.periodTotals || {};
  const income = Number(totals.income) || 0;
  const expenses = Number(totals.expenses) || 0;
  const net = round2(income - expenses);

  const daysInPeriod = Math.max(period.durationDays + 1, 1);

  const dailyFlow = normalizeArray(raw.dailyFlow).map((item) => ({
    date: item.date,
    label: item.label,
    income: Number(item.income) || 0,
    expenses: Number(item.expenses) || 0,
    net: Number(item.net) || 0,
    accumulated: Number(item.accumulated) || 0,
  }));

  const weeklyFlow = normalizeArray(raw.weeklyFlow).map((item) => ({
    weekStart: item.weekStart,
    label: item.label,
    income: Number(item.income) || 0,
    expenses: Number(item.expenses) || 0,
    net: Number(item.net) || 0,
  }));

  const monthlyFlow = normalizeArray(raw.monthlyFlow).map((item) => ({
    month: item.month,
    monthStart: item.monthStart,
    income: Number(item.income) || 0,
    expenses: Number(item.expenses) || 0,
    net: Number(item.net) || 0,
  }));

  const projection = projectBalanceMonthEnd({
    currentBalance,
    totalIncome: income,
    totalExpenses: expenses,
    startDate: period.startDate,
    endDate: period.endDate,
  });

  const lastAccumulated =
    dailyFlow.length > 0 ? dailyFlow[dailyFlow.length - 1].accumulated : net;

  return {
    meta: {
      period: period.period,
      startDate: period.startDate,
      endDate: period.endDate,
      compareStartDate: period.compareStartDate,
      compareEndDate: period.compareEndDate,
      granularity: period.granularity,
      generatedAt: new Date().toISOString(),
    },
    kpis: {
      income: round2(income),
      expenses: round2(expenses),
      net,
      currentBalance: round2(currentBalance),
      accumulatedBalance: round2(lastAccumulated),
      avgDailyIncome: projection.avgDailyIncome,
      avgDailyExpense: projection.avgDailyExpense,
      projectedBalance: projection.projectedBalance,
    },
    charts: {
      entriesVsExits: {
        income: round2(income),
        expenses: round2(expenses),
        net,
      },
      dailyFlow,
      weeklyFlow,
      monthlyFlow,
      accumulatedBalance: dailyFlow.map((item) => ({
        date: item.date,
        label: item.label,
        value: item.accumulated,
      })),
    },
    projection,
  };
}

module.exports = { buildCashflowDashboard };
