const investmentsService = require("../../investments/investments.service");
const analyticsService = require("../../analytics/analytics.service");
const marketService = require("../../market-data/market.service");
const rateService = require("../../market-data/rate.service");
const usersService = require("../../users/users.service");
const CacheService = require("../cache/cache.service");
const { BFF_CACHE_TTL } = require("../bff.constants");
const { parallel } = require("../utils/parallel");

/**
 * InvestmentBFFService — carteira completa em uma chamada.
 */
async function buildInvestments(userId, query = {}) {
  const result = await parallel({
    user: () => usersService.getProfile(userId),
    portfolio: {
      fn: () => investmentsService.listDetailed(userId),
      optional: true,
      fallback: [],
    },
    summary: {
      fn: () => investmentsService.portfolioSummary(userId),
      optional: true,
      fallback: null,
    },
    analytics: {
      fn: () => analyticsService.getInvestments(userId, query),
      optional: true,
      fallback: null,
    },
    market: {
      fn: () => marketService.getOverview(),
      optional: true,
      fallback: null,
    },
    rates: {
      fn: () => rateService.getCurrentRates(),
      optional: true,
      fallback: null,
    },
  });

  const portfolio = result.portfolio || [];
  const summary = result.summary || {};
  const analytics = result.analytics || {};

  const categories = {};
  for (const item of portfolio || []) {
    const key = item.categoryName || item.investmentType || "Outros";
    categories[key] = (categories[key] || 0) + Number(item.currentValue || item.amount || 0);
  }

  return {
    user: result.user,
    portfolio,
    summary,
    profitability: analytics.profitability || summary.profitability || null,
    indicators: analytics.indicators || summary.kpis || null,
    chart: analytics.charts || analytics.chart || null,
    categories,
    distribution: analytics.distribution || summary.allocation || categories,
    projections: analytics.projections || summary.projections || null,
    market: result.market,
    rates: result.rates,
    simulations: (portfolio || [])
      .filter((item) => item.simulation)
      .map((item) => ({
        id: item.id,
        name: item.name,
        simulation: item.simulation,
      })),
    analytics,
  };
}

async function getInvestments(userId, query = {}) {
  const period = query.period || "30d";
  const cacheKey = CacheService.buildKey("investments", userId, period);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL.investments,
    () => buildInvestments(userId, query),
  );

  return { data, cacheHit };
}

module.exports = { getInvestments, buildInvestments };
