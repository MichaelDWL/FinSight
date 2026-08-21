const dashboardService = require("../../dashboard/dashboard.service");
const CacheService = require("../cache/cache.service");
const { BFF_CACHE_TTL } = require("../bff.constants");
const { parallel } = require("../utils/parallel");
const { resolveUser } = require("../utils/resolveUser");

/**
 * HomeBFFService — caminho critico enxuto + enriquecimento secundario.
 * Sem regras de negocio.
 */

function shapeHomeCore(user, core) {
  const recentTransactions = core.latestTransactions || core.transactions || [];

  return {
    user,
    summary: {
      balance: core.balance,
      income: core.income,
      expenses: core.expenses,
      netWorth: core.netWorth,
      investmentsTotal: core.investmentsTotal,
      monthlyBalance: core.monthlyBalance,
      trends: core.trends,
    },
    accounts: core.accounts || [],
    cards: core.cards || [],
    investments: [],
    goals: [],
    alerts: [],
    notifications: [],
    insights: [],
    nextBills: [],
    recentTransactions,
    charts: {
      monthlyFlow: [],
      wealthBreakdown: core.wealthBreakdown || {},
      flowSummary: {},
    },
    // Compatibilidade com homeView atual (campos flat)
    ...core,
    user,
    meta: { scope: "core", secondaryPending: true },
  };
}

function shapeHomeSecondary(secondary) {
  return {
    ...secondary,
    nextBills: (secondary.pendingBills || []).slice(0, 8),
    notifications: secondary.personalization?.notifications || [],
    charts: {
      monthlyFlow: secondary.monthlyFlow || [],
      flowSummary: secondary.flowSummary || {},
    },
    meta: { scope: "secondary", secondaryPending: false },
  };
}

async function buildHome(userId, options = {}) {
  const { user, core } = await parallel({
    user: () => resolveUser(userId, options),
    core: () => dashboardService.getHomeCore(userId),
  });

  return shapeHomeCore(user, core);
}

async function buildHomeSecondary(userId) {
  const secondary = await dashboardService.getHomeSecondary(userId);
  return shapeHomeSecondary(secondary);
}

async function getHome(userId, _query = {}, options = {}) {
  const cacheKey = CacheService.buildKey("home", userId);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL.home,
    () => buildHome(userId, options),
  );

  return { data, cacheHit };
}

async function getHomeSecondary(userId, _query = {}, _options = {}) {
  const cacheKey = CacheService.buildKey("home-secondary", userId);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL["home-secondary"],
    () => buildHomeSecondary(userId),
  );

  return { data, cacheHit };
}

module.exports = {
  getHome,
  buildHome,
  getHomeSecondary,
  buildHomeSecondary,
  shapeHomeCore,
  shapeHomeSecondary,
};
