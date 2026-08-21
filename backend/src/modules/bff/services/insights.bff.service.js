const goalsService = require("../../goals/goals.service");
const personalizationEngine = require("../../personalization/engine/PersonalizationEngine");
const CacheService = require("../cache/cache.service");
const { BFF_CACHE_TTL } = require("../bff.constants");
const { parallel } = require("../utils/parallel");
const { resolveUser } = require("../utils/resolveUser");

/**
 * InsightsBFFService — metas + personalizacao (somente leitura).
 * Nao carrega getDashboard completo (evita dezenas de queries duplicadas).
 */
async function buildInsights(userId, options = {}) {
  const result = await parallel({
    user: () => resolveUser(userId, options),
    personalization: {
      fn: () => personalizationEngine.readContext(userId),
      optional: true,
      fallback: null,
    },
    goals: { fn: () => goalsService.list(userId), optional: true, fallback: [] },
  });

  const personalization = result.personalization || {};

  return {
    user: result.user,
    alerts: personalization.alerts || [],
    recommendations: personalization.recommendations || [],
    goals: result.goals,
    savings: {
      monthlyBalance: null,
      freeBudget: null,
      budgets: personalization.budgets || [],
      progress: personalization.progress || [],
    },
    financialHealth: {
      score: personalization.health || null,
      chips: [],
      wealthBreakdown: null,
    },
    insights: personalization.insights || [],
    personalization,
  };
}

async function getInsights(userId, _query = {}, options = {}) {
  const cacheKey = CacheService.buildKey("insights", userId);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL.insights,
    () => buildInsights(userId, options),
  );

  return { data, cacheHit };
}

module.exports = { getInsights, buildInsights };
