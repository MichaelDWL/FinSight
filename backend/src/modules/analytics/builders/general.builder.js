const { buildFinancialHealth, round2 } = require("../engines/financialHealth.engine");
const { buildInsights } = require("../engines/insights.engine");

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

function buildFlowSummary(categoryComparison) {
  const currentCategories = categoryComparison
    .filter((item) => item.currentMonth > 0)
    .sort((a, b) => b.currentMonth - a.currentMonth);

  const topExpenseCategory = currentCategories[0] || null;

  const fastestGrowing = [...categoryComparison]
    .map((item) => {
      const growth =
        item.previousMonth > 0
          ? round2(((item.currentMonth - item.previousMonth) / item.previousMonth) * 100)
          : item.currentMonth > 0
            ? 100
            : 0;

      return { ...item, growth };
    })
    .filter((item) => item.currentMonth > 0 && item.growth > 0)
    .sort((a, b) => b.growth - a.growth)[0];

  return {
    topExpenseCategory: topExpenseCategory
      ? {
          name: topExpenseCategory.category,
          value: topExpenseCategory.currentMonth,
        }
      : null,
    fastestGrowingCategory: fastestGrowing
      ? {
          name: fastestGrowing.category,
          growth: fastestGrowing.growth,
          value: fastestGrowing.currentMonth,
        }
      : null,
  };
}

function buildGeneralDashboard(raw, period, options = {}) {
  const patrimonio = raw.patrimonio || {};
  const periodSummary = raw.periodSummary || {};
  const previousSummary = raw.previousSummary || {};

  const balance = Number(patrimonio.balance) || 0;
  const investments = Number(patrimonio.investments) || 0;
  const netWorth = round2(balance + investments);
  const income = Number(periodSummary.income) || 0;
  const expenses = Number(periodSummary.expenses) || 0;
  const previousIncome = Number(previousSummary.income) || 0;
  const previousExpenses = Number(previousSummary.expenses) || 0;
  const monthlyBalance = round2(income - expenses);

  const monthlyFlow = normalizeArray(raw.monthlyFlow).map((item) => ({
    month: item.month,
    monthStart: item.monthStart,
    income: Number(item.income) || 0,
    expenses: Number(item.expenses) || 0,
    balance: Number(item.balance) || 0,
  }));

  const categoryDistribution = normalizeArray(raw.categoryDistribution).map((item) => ({
    category: item.category,
    color: item.color,
    value: Number(item.value) || 0,
  }));

  const categoryComparison = normalizeArray(raw.categoryComparison).map((item) => ({
    category: item.category,
    currentMonth: Number(item.currentMonth) || 0,
    previousMonth: Number(item.previousMonth) || 0,
  }));

  const upcomingBills = normalizeArray(raw.upcomingBills).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    icon: item.icon || "fa-file-invoice-dollar",
    value: Number(item.value) || 0,
    dueDate: item.dueDate,
    status: item.status,
  }));

  const recentMovements = normalizeArray(raw.recentMovements).map((item) => ({
    id: item.id,
    description: item.description,
    category: item.category,
    icon: item.icon || "wallet",
    type: item.type,
    value: Number(item.value) || 0,
    date: item.date,
    status: item.status,
    payment: item.payment,
    account: item.account,
  }));

  const cards = normalizeArray(raw.cards).map((item) => ({
    id: item.id,
    name: item.name,
    totalLimit: Number(item.totalLimit) || 0,
    usedLimit: Number(item.usedLimit) || 0,
    availableLimit: Number(item.availableLimit) || 0,
    dueDay: Number(item.dueDay) || null,
    closingDay: Number(item.closingDay) || null,
    invoiceTotal: Number(item.invoiceTotal) || 0,
    invoiceDueDate: item.invoiceDueDate,
  }));

  const pendingBillsTotal = Number(raw.pendingBillsTotal) || 0;

  const healthScore = buildFinancialHealth({
    income,
    expenses,
    previousIncome,
    previousExpenses,
    pendingBillsTotal,
    cards,
    monthlyFlow,
  });

  const insights = buildInsights({
    income,
    expenses,
    previousExpenses,
    monthlyBalance,
    monthlyFlow,
    categoryComparison,
    upcomingBills,
    cards,
    netWorth,
  });

  const totalCategoryValue = categoryDistribution.reduce((sum, item) => sum + item.value, 0);
  const categoryDistributionWithPercent = categoryDistribution.map((item) => ({
    ...item,
    percent: totalCategoryValue > 0 ? round2((item.value / totalCategoryValue) * 100) : 0,
  }));

  const personalization = options.personalization || null;
  const personalizedInsights = personalization?.insights?.length
    ? [...personalization.insights, ...insights].slice(0, 8)
    : insights;

  const kpiOrder = personalization?.dashboards?.general?.kpiOrder || [
    "balance",
    "netWorth",
    "income",
    "expenses",
    "investments",
    "pendingBills",
  ];

  const kpisRaw = {
    balance: round2(balance),
    netWorth,
    income: round2(income),
    expenses: round2(expenses),
    monthlyBalance,
    investments: round2(investments),
    pendingBills: round2(pendingBillsTotal),
  };

  const orderedKpis = {};
  for (const key of kpiOrder) {
    if (kpisRaw[key] !== undefined) orderedKpis[key] = kpisRaw[key];
  }
  for (const [key, value] of Object.entries(kpisRaw)) {
    if (orderedKpis[key] === undefined) orderedKpis[key] = value;
  }

  return {
    meta: {
      period: period.period,
      startDate: period.startDate,
      endDate: period.endDate,
      compareStartDate: period.compareStartDate,
      compareEndDate: period.compareEndDate,
      granularity: period.granularity,
      generatedAt: new Date().toISOString(),
      personalization: personalization
        ? {
            profileType: personalization.profile?.type,
            profileTitle: personalization.profile?.title,
            homePriority: personalization.home?.priority || [],
          }
        : null,
    },
    kpis: orderedKpis,
    kpiOrder,
    trends: {
      income: calcTrend(income, previousIncome),
      expenses: calcTrend(expenses, previousExpenses),
      netWorth: calcTrend(netWorth, netWorth - monthlyBalance),
      balance: calcTrend(balance, balance - monthlyBalance),
    },
    charts: {
      monthlyFlow,
      categoryDistribution: categoryDistributionWithPercent,
    },
    lists: {
      upcomingBills,
      recentMovements,
    },
    flowSummary: buildFlowSummary(categoryComparison),
    cards,
    healthScore: personalization?.health
      ? {
          value: Math.round(Number(personalization.health.score) || 0),
          tone:
            personalization.health.score >= 75
              ? "positive"
              : personalization.health.score < 50
                ? "warning"
                : "neutral",
          label: personalization.health.label,
          factors: personalization.health.factors,
        }
      : healthScore,
    budgets: personalization?.budgets || [],
    progress: personalization?.progress || [],
    recommendations: personalization?.recommendations || [],
    alerts: personalization?.alerts || [],
    healthHistory: personalization?.health?.history || null,
    insights: personalizedInsights,
    personalization,
  };
}

module.exports = { buildGeneralDashboard };
