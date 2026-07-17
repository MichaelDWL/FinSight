const usersService = require("../../users/users.service");
const dashboardService = require("../../dashboard/dashboard.service");
const CacheService = require("../cache/cache.service");
const { BFF_CACHE_TTL } = require("../bff.constants");
const { parallel } = require("../utils/parallel");

/**
 * HomeBFFService — apenas orquestra services existentes.
 * Sem regras de negocio.
 */
async function buildHome(userId) {
  const { user, dashboard } = await parallel({
    user: () => usersService.getProfile(userId),
    dashboard: () => dashboardService.getDashboard(userId),
  });

  const pendingBills = dashboard.pendingBills || [];
  const recentTransactions = dashboard.latestTransactions || [];

  return {
    user,
    summary: {
      balance: dashboard.balance,
      income: dashboard.income,
      expenses: dashboard.expenses,
      netWorth: dashboard.netWorth,
      investmentsTotal: dashboard.investmentsTotal,
      monthlyBalance: dashboard.monthlyBalance,
      trends: dashboard.trends,
    },
    accounts: dashboard.accounts || [],
    cards: dashboard.cards || [],
    investments: dashboard.investments || [],
    goals: dashboard.goals || [],
    alerts: dashboard.alerts || [],
    notifications: dashboard.personalization?.notifications || [],
    insights: dashboard.insights || [],
    nextBills: pendingBills.slice(0, 8),
    recentTransactions,
    charts: {
      monthlyFlow: dashboard.monthlyFlow || [],
      wealthBreakdown: dashboard.wealthBreakdown || {},
      flowSummary: dashboard.flowSummary || {},
    },
    // Compatibilidade com homeView atual (campos flat)
    ...dashboard,
    user,
  };
}

async function getHome(userId) {
  const cacheKey = CacheService.buildKey("home", userId);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL.home,
    () => buildHome(userId),
  );

  return { data, cacheHit };
}

module.exports = { getHome, buildHome };
