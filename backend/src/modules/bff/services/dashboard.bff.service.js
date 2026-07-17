const analyticsService = require("../../analytics/analytics.service");
const usersService = require("../../users/users.service");
const accountsService = require("../../accounts/accounts.service");
const cardsService = require("../../cards/cards.service");
const goalsService = require("../../goals/goals.service");
const CacheService = require("../cache/cache.service");
const { BFF_CACHE_TTL } = require("../bff.constants");
const { parallel } = require("../utils/parallel");

/**
 * DashboardBFFService — agrega todos os painéis analytics em um JSON.
 */
async function buildDashboard(userId, query = {}) {
  const period = query.period || "30d";

  const result = await parallel({
    user: () => usersService.getProfile(userId),
    general: () => analyticsService.getGeneral(userId, query),
    expenses: () => analyticsService.getExpenses(userId, query),
    cashflow: () => analyticsService.getCashflow(userId, query),
    cardsAnalytics: () => analyticsService.getCards(userId, query),
    investmentsAnalytics: () => analyticsService.getInvestments(userId, query),
    accounts: { fn: () => accountsService.list(userId), optional: true, fallback: [] },
    cards: { fn: () => cardsService.list(userId), optional: true, fallback: [] },
    goals: { fn: () => goalsService.list(userId), optional: true, fallback: [] },
  });

  const general = result.general || {};
  const personalization = general.personalization || null;

  return {
    user: result.user,
    period,
    summary: general.kpis || general.summary || general,
    charts: {
      general: general.charts || null,
      expenses: result.expenses?.charts || null,
      cashflow: result.cashflow?.charts || null,
      cards: result.cardsAnalytics?.charts || null,
      investments: result.investmentsAnalytics?.charts || null,
    },
    cashflow: result.cashflow,
    cards: {
      list: result.cards,
      analytics: result.cardsAnalytics,
    },
    investments: result.investmentsAnalytics,
    wealth: general.wealth || result.investmentsAnalytics?.wealth || null,
    monthlyComparison: result.expenses?.comparison || result.cashflow?.comparison || null,
    alerts: personalization?.alerts || general.alerts || [],
    goals: result.goals,
    indicators: general.indicators || general.kpis || null,
    insights: personalization?.insights || general.insights || [],
    sections: {
      general: result.general,
      expenses: result.expenses,
      cashflow: result.cashflow,
      cards: result.cardsAnalytics,
      investments: result.investmentsAnalytics,
    },
    accounts: result.accounts,
    personalization,
  };
}

async function getDashboard(userId, query = {}) {
  const period = query.period || "30d";
  const cacheKey = CacheService.buildKey("dashboard", userId, period);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL.dashboard,
    () => buildDashboard(userId, query),
  );

  return { data, cacheHit };
}

module.exports = { getDashboard, buildDashboard };
