const analyticsService = require("../../analytics/analytics.service");
const investmentsService = require("../../investments/investments.service");
const goalsService = require("../../goals/goals.service");
const dashboardRepository = require("../../dashboard/dashboard.repository");
const CacheService = require("../cache/cache.service");
const { BFF_CACHE_TTL } = require("../bff.constants");
const { parallel } = require("../utils/parallel");
const { resolveUser } = require("../utils/resolveUser");

/**
 * ReportsBFFService — relatorios compostos sem getDashboard completo.
 */
async function buildReports(userId, query = {}, options = {}) {
  const periodQuery = { ...query, period: query.period || "1y" };

  const result = await parallel({
    user: () => resolveUser(userId, options),
    financial: {
      fn: () => dashboardRepository.getFinancialSummaries(userId),
      optional: true,
      fallback: null,
    },
    monthlyFlow: {
      fn: () => dashboardRepository.getMonthlyFlow(userId, 12),
      optional: true,
      fallback: [],
    },
    general: {
      fn: () => analyticsService.getGeneral(userId, periodQuery),
      optional: true,
      fallback: null,
    },
    expenses: {
      fn: () => analyticsService.getExpenses(userId, periodQuery),
      optional: true,
      fallback: null,
    },
    cashflow: {
      fn: () => analyticsService.getCashflow(userId, periodQuery),
      optional: true,
      fallback: null,
    },
    investments: {
      fn: () => investmentsService.portfolioSummary(userId),
      optional: true,
      fallback: null,
    },
    goals: {
      fn: () => goalsService.list(userId),
      optional: true,
      fallback: [],
    },
  });

  const summary = result.financial?.summary || {};
  const monthlyBalance =
    summary.income != null && summary.expenses != null
      ? Number(summary.income) - Number(summary.expenses)
      : null;

  return {
    user: result.user,
    annualSummary: result.general || {
      balance: summary.balance ?? null,
      income: summary.income ?? null,
      expenses: summary.expenses ?? null,
      netWorth: summary.netWorth ?? null,
    },
    monthlySummary: {
      income: summary.income ?? null,
      expenses: summary.expenses ?? null,
      monthlyBalance,
      trends: null,
      monthlyFlow: result.monthlyFlow || [],
    },
    categories: result.expenses || null,
    investments: {
      list: result.investments?.byAsset || [],
      summary: result.investments,
    },
    cashflow: result.cashflow || { monthlyFlow: result.monthlyFlow },
    comparisons: {
      previousMonth: result.financial?.previousMonth || null,
      category: null,
      expenses: result.expenses?.comparison || null,
    },
    charts: {
      monthlyFlow: result.monthlyFlow || [],
      wealthBreakdown: {
        investments: summary.investmentsTotal ?? null,
      },
      expenses: result.expenses?.charts || null,
      cashflow: result.cashflow?.charts || null,
      general: result.general?.charts || null,
    },
    goals: result.goals || [],
    transactions: [],
  };
}

async function getReports(userId, query = {}, options = {}) {
  const period = query.period || "1y";
  const cacheKey = CacheService.buildKey("reports", userId, period);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL.reports,
    () => buildReports(userId, query, options),
  );

  return { data, cacheHit };
}

module.exports = { getReports, buildReports };
