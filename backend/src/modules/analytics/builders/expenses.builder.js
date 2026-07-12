const { round2 } = require("../engines/financialHealth.engine");
const { projectExpenseMonthEnd } = require("../engines/projection.engine");

function calcTrend(current, previous) {
  const curr = Number(current) || 0;
  const prev = Number(previous) || 0;

  if (prev === 0 && curr === 0) {
    return { direction: "neutral", percent: 0, label: "Sem variacao" };
  }

  if (prev === 0) {
    return { direction: "up", percent: 100, label: "+100% vs periodo anterior" };
  }

  const change = round2(((curr - prev) / Math.abs(prev)) * 100);
  const direction = change > 0 ? "up" : change < 0 ? "down" : "neutral";
  const sign = change > 0 ? "+" : "";

  return {
    direction,
    percent: Math.abs(change),
    label: `${sign}${change}% vs periodo anterior`,
  };
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [];
}

function buildFastestGrowing(categoryComparison) {
  return [...categoryComparison]
    .map((item) => {
      const growth =
        item.previousPeriod > 0
          ? round2(((item.currentPeriod - item.previousPeriod) / item.previousPeriod) * 100)
          : item.currentPeriod > 0
            ? 100
            : 0;

      return { ...item, growth };
    })
    .filter((item) => item.currentPeriod > 0 && item.growth > 0)
    .sort((a, b) => b.growth - a.growth)
    .slice(0, 5);
}

function buildExpensesDashboard(raw, period) {
  const totals = raw.periodTotals || {};
  const total = Number(totals.total) || 0;
  const previousTotal = Number(totals.previous_total) || 0;
  const transactionsCount = Number(totals.transactions_count) || 0;

  const daysInPeriod = Math.max(period.durationDays + 1, 1);
  const avgDaily = round2(total / daysInPeriod);

  const byCategory = normalizeArray(raw.byCategory).map((item) => ({
    category: item.category,
    color: item.color,
    value: Number(item.value) || 0,
  }));

  const totalCategoryValue = byCategory.reduce((sum, item) => sum + item.value, 0);
  const byCategoryWithPercent = byCategory.map((item) => ({
    ...item,
    percent: totalCategoryValue > 0 ? round2((item.value / totalCategoryValue) * 100) : 0,
  }));

  const byDay = normalizeArray(raw.byDay).map((item) => ({
    date: item.date,
    label: item.label,
    value: Number(item.value) || 0,
  }));

  const byMonth = normalizeArray(raw.byMonth).map((item) => ({
    month: item.month,
    monthStart: item.monthStart,
    value: Number(item.value) || 0,
  }));

  const categoryComparison = normalizeArray(raw.categoryComparison).map((item) => ({
    category: item.category,
    color: item.color,
    currentPeriod: Number(item.currentPeriod) || 0,
    previousPeriod: Number(item.previousPeriod) || 0,
  }));

  const topExpenses = normalizeArray(raw.topExpenses).map((item) => ({
    id: item.id,
    description: item.description,
    category: item.category,
    color: item.color,
    icon: item.icon,
    value: Number(item.value) || 0,
    date: item.date,
    account: item.account,
  }));

  const fastestGrowing = buildFastestGrowing(categoryComparison);
  const projection = projectExpenseMonthEnd({
    totalExpenses: total,
    startDate: period.startDate,
    endDate: period.endDate,
  });

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
      total: round2(total),
      previousTotal: round2(previousTotal),
      avgDaily,
      transactionsCount,
      projectedMonthEnd: projection.projectedTotal,
    },
    trends: {
      total: calcTrend(total, previousTotal),
    },
    charts: {
      byCategory: byCategoryWithPercent,
      byDay,
      byMonth,
      categoryComparison,
      evolution: byMonth,
    },
    lists: {
      topExpenses,
      fastestGrowing,
    },
    projection,
  };
}

module.exports = { buildExpensesDashboard };
