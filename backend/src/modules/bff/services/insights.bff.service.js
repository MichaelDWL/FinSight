const usersService = require("../../users/users.service");
const goalsService = require("../../goals/goals.service");
const personalizationEngine = require("../../personalization/engine/PersonalizationEngine");
const dashboardService = require("../../dashboard/dashboard.service");
const CacheService = require("../cache/cache.service");
const { BFF_CACHE_TTL } = require("../bff.constants");
const { parallel } = require("../utils/parallel");

/**
 * InsightsBFFService — alertas, recomendacoes, metas e saude financeira.
 */
async function buildInsights(userId) {
  const result = await parallel({
    user: () => usersService.getProfile(userId),
    personalization: {
      fn: () => personalizationEngine.rebuildContext(userId),
      optional: true,
      fallback: null,
    },
    goals: { fn: () => goalsService.list(userId), optional: true, fallback: [] },
    dashboard: {
      fn: () => dashboardService.getDashboard(userId),
      optional: true,
      fallback: null,
    },
  });

  const personalization = result.personalization || {};
  const dashboard = result.dashboard || {};

  return {
    user: result.user,
    alerts: personalization.alerts || dashboard.alerts || [],
    recommendations: personalization.recommendations || dashboard.recommendations || [],
    goals: result.goals,
    savings: {
      monthlyBalance: dashboard.monthlyBalance ?? null,
      freeBudget: dashboard.monthlyBalance ?? null,
      budgets: personalization.budgets || dashboard.budgets || [],
      progress: personalization.progress || dashboard.progress || [],
    },
    financialHealth: {
      score: personalization.health || dashboard.healthScore || null,
      chips: dashboard.financialHealth || [],
      wealthBreakdown: dashboard.wealthBreakdown || null,
    },
    insights: personalization.insights || dashboard.insights || [],
    personalization,
  };
}

async function getInsights(userId) {
  const cacheKey = CacheService.buildKey("insights", userId);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL.insights,
    () => buildInsights(userId),
  );

  return { data, cacheHit };
}

module.exports = { getInsights, buildInsights };
