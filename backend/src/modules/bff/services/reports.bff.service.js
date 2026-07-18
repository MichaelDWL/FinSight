const dashboardService = require("../../dashboard/dashboard.service");
const analyticsService = require("../../analytics/analytics.service");
const investmentsService = require("../../investments/investments.service");
const usersService = require("../../users/users.service");
const CacheService = require("../cache/cache.service");
const { BFF_CACHE_TTL } = require("../bff.constants");
const { parallel } = require("../utils/parallel");

/**
 * ReportsBFFService — relatorios compostos.
 */
async function buildReports(userId, query = {}) {
  const result = await parallel({
    user: () => usersService.getProfile(userId),
    dashboard: () => dashboardService.getDashboard(userId),
    general: {
      fn: () => analyticsService.getGeneral(userId, { ...query, period: query.period || "1y" }),
      optional: true,
      fallback: null,
    },
    expenses: {
      fn: () => analyticsService.getExpenses(userId, { ...query, period: query.period || "1y" }),
      optional: true,
      fallback: null,
    },
    cashflow: {
      fn: () => analyticsService.getCashflow(userId, { ...query, period: query.period || "1y" }),
      optional: true,
      fallback: null,
    },
    investments: {
      fn: () => investmentsService.portfolioSummary(userId),
      optional: true,
      fallback: null,
    },
  });

  const dashboard = result.dashboard || {};

  return {
    user: result.user,
    annualSummary: result.general || {
      balance: dashboard.balance,
      income: dashboard.income,
      expenses: dashboard.expenses,
      netWorth: dashboard.netWorth,
    },
    monthlySummary: {
      income: dashboard.income,
      expenses: dashboard.expenses,
      monthlyBalance: dashboard.monthlyBalance,
      trends: dashboard.trends,
      monthlyFlow: dashboard.monthlyFlow,
    },
    categories: result.expenses || dashboard.flowSummary || null,
    investments: {
      list: dashboard.investments || [],
      summary: result.investments,
    },
    cashflow: result.cashflow || { monthlyFlow: dashboard.monthlyFlow },
    comparisons: {
      previousMonth: dashboard.trends || null,
      category: dashboard.flowSummary || null,
      expenses: result.expenses?.comparison || null,
    },
    charts: {
      monthlyFlow: dashboard.monthlyFlow || [],
      wealthBreakdown: dashboard.wealthBreakdown || {},
      expenses: result.expenses?.charts || null,
      cashflow: result.cashflow?.charts || null,
      general: result.general?.charts || null,
    },
    goals: dashboard.goals || [],
    transactions: dashboard.transactions || [],
  };
}

async function getReports(userId, query = {}) {
  const period = query.period || "1y";
  const cacheKey = CacheService.buildKey("reports", userId, period);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL.reports,
    () => buildReports(userId, query),
  );

  return { data, cacheHit };
}

module.exports = { getReports, buildReports };
