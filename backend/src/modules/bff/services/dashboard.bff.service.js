const analyticsService = require("../../analytics/analytics.service");
const accountsService = require("../../accounts/accounts.service");
const cardsService = require("../../cards/cards.service");
const goalsService = require("../../goals/goals.service");
const CacheService = require("../cache/cache.service");
const { BFF_CACHE_TTL } = require("../bff.constants");
const { parallel } = require("../utils/parallel");
const { resolveUser } = require("../utils/resolveUser");

const SECTION_LOADERS = {
  general: (userId, query) => analyticsService.getGeneral(userId, query),
  expenses: (userId, query) => analyticsService.getExpenses(userId, query),
  cashflow: (userId, query) => analyticsService.getCashflow(userId, query),
  cards: (userId, query) => analyticsService.getCards(userId, query),
  investments: (userId, query) => analyticsService.getInvestments(userId, query),
};

const VALID_SECTIONS = new Set(Object.keys(SECTION_LOADERS));

function normalizeSection(section) {
  if (!section) return null;
  const value = String(section).trim().toLowerCase();
  return VALID_SECTIONS.has(value) ? value : null;
}

/**
 * Painel unico — usado quando o frontend pede ?section=.
 * Carrega apenas o analytics necessario para a tela atual.
 */
async function buildDashboardSection(userId, query = {}, options = {}) {
  const period = query.period || "30d";
  const section = normalizeSection(query.section);

  const loader = SECTION_LOADERS[section];
  const { user, panel } = await parallel({
    user: () => resolveUser(userId, options),
    panel: () => loader(userId, query),
  });

  const personalization = panel?.personalization || null;

  return {
    user,
    period,
    sections: {
      [section]: panel,
    },
    personalization,
    meta: {
      scope: "section",
      section,
      secondaryPending: false,
    },
  };
}

/**
 * Payload completo (legado / consumidores sem section).
 * Mantido para compatibilidade; o frontend de analytics usa section.
 */
async function buildDashboardFull(userId, query = {}, options = {}) {
  const period = query.period || "30d";

  const result = await parallel({
    user: () => resolveUser(userId, options),
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
    meta: {
      scope: "full",
      section: null,
      secondaryPending: false,
    },
  };
}

async function buildDashboard(userId, query = {}, options = {}) {
  const section = normalizeSection(query.section);
  if (section) {
    return buildDashboardSection(userId, { ...query, section }, options);
  }
  return buildDashboardFull(userId, query, options);
}

async function getDashboard(userId, query = {}, options = {}) {
  const period = query.period || "30d";
  const section = normalizeSection(query.section);
  const cacheVariant = section ? `${period}:${section}` : period;
  const cacheKey = CacheService.buildKey("dashboard", userId, cacheVariant);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL.dashboard,
    () => buildDashboard(userId, query, options),
  );

  return { data, cacheHit };
}

module.exports = {
  getDashboard,
  buildDashboard,
  buildDashboardSection,
  buildDashboardFull,
  normalizeSection,
  VALID_SECTIONS,
  SECTION_LOADERS,
};
