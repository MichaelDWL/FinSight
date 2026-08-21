const { cacheAdapter, buildCacheKey } = require("./analytics.cache");
const { CACHE_TTL } = require("./constants");
const { resolvePeriod } = require("./period.resolver");
const generalRepository = require("./repositories/general.analytics");
const expensesRepository = require("./repositories/expenses.analytics");
const cashflowRepository = require("./repositories/cashflow.analytics");
const cardsRepository = require("./repositories/cards.analytics");
const investmentsRepository = require("./repositories/investments.analytics");
const { buildGeneralDashboard } = require("./builders/general.builder");
const { buildExpensesDashboard } = require("./builders/expenses.builder");
const { buildCashflowDashboard } = require("./builders/cashflow.builder");
const { buildCardsDashboard } = require("./builders/cards.builder");
const { buildInvestmentsDashboard } = require("./builders/investments.builder");
const { consolidatePortfolioAnalytics } = require("./services/investmentAnalytics.service");
const personalizationEngine = require("../personalization/engine/PersonalizationEngine");
const { attachPersonalization } = require("../personalization/utils/orderKpis");

async function loadPersonalization(userId) {
  return personalizationEngine.readContext(userId).catch(() => null);
}

async function withCachedDashboard(userId, dashboard, query, ttlSeconds, buildResult) {
  const period = resolvePeriod(query);
  const cacheKey = buildCacheKey(userId, dashboard, period);
  const cached = await cacheAdapter.get(cacheKey);
  if (cached) return cached;

  const result = await buildResult(period);
  await cacheAdapter.set(cacheKey, result, ttlSeconds);
  return result;
}

async function getGeneral(userId, query = {}) {
  return withCachedDashboard(userId, "general", query, CACHE_TTL.general, async (period) => {
    const [raw, personalization] = await Promise.all([
      generalRepository.fetchGeneralDashboard(userId, period),
      loadPersonalization(userId),
    ]);
    return buildGeneralDashboard(raw, period, { personalization });
  });
}

async function getExpenses(userId, query = {}) {
  return withCachedDashboard(userId, "expenses", query, CACHE_TTL.expenses, async (period) => {
    const [raw, personalization] = await Promise.all([
      expensesRepository.fetchExpensesDashboard(userId, period),
      loadPersonalization(userId),
    ]);
    return attachPersonalization(
      buildExpensesDashboard(raw, period),
      personalization,
      "expenses",
    );
  });
}

async function getCashflow(userId, query = {}) {
  return withCachedDashboard(userId, "cashflow", query, CACHE_TTL.cashflow, async (period) => {
    const [raw, personalization] = await Promise.all([
      cashflowRepository.fetchCashflowDashboard(userId, period),
      loadPersonalization(userId),
    ]);
    return attachPersonalization(
      buildCashflowDashboard(raw, period),
      personalization,
      "cashflow",
    );
  });
}

async function getCards(userId, query = {}) {
  return withCachedDashboard(userId, "cards", query, CACHE_TTL.cards, async (period) => {
    const [raw, personalization] = await Promise.all([
      cardsRepository.fetchCardsDashboard(userId, period),
      loadPersonalization(userId),
    ]);
    return attachPersonalization(
      buildCardsDashboard(raw, period),
      personalization,
      "cards",
    );
  });
}

async function getInvestments(userId, query = {}) {
  const period = resolvePeriod(query);
  const cacheKey = buildCacheKey(userId, "investments", period);
  const cached = await cacheAdapter.get(cacheKey);
  if (cached) return cached;

  const [raw, intelligence, personalization] = await Promise.all([
    investmentsRepository.fetchInvestmentsDashboard(userId, period),
    consolidatePortfolioAnalytics(userId),
    loadPersonalization(userId),
  ]);

  const result = attachPersonalization(
    {
      ...buildInvestmentsDashboard(raw, period),
      economicRates: intelligence.economicRates,
      portfolioIntelligence: intelligence.portfolio,
      portfolioProjection: intelligence.portfolioProjection,
    },
    personalization,
    "investments",
  );

  await cacheAdapter.set(cacheKey, result, CACHE_TTL.investments);
  return result;
}

module.exports = { getGeneral, getExpenses, getCashflow, getCards, getInvestments };
