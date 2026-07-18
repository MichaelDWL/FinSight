const recurrenceService = require("../../services/recurrence.service");
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
  return personalizationEngine.rebuildContext(userId).catch(() => null);
}

async function getGeneral(userId, query = {}) {
  await recurrenceService.ensureGenerated(userId);

  const period = resolvePeriod(query);
  const cacheKey = buildCacheKey(userId, "general", period);
  const cached = await cacheAdapter.get(cacheKey);
  if (cached) return cached;

  const [raw, personalization] = await Promise.all([
    generalRepository.fetchGeneralDashboard(userId, period),
    loadPersonalization(userId),
  ]);
  const result = buildGeneralDashboard(raw, period, { personalization });

  await cacheAdapter.set(cacheKey, result, CACHE_TTL.general);
  return result;
}

async function getExpenses(userId, query = {}) {
  await recurrenceService.ensureGenerated(userId);

  const period = resolvePeriod(query);
  const cacheKey = buildCacheKey(userId, "expenses", period);
  const cached = await cacheAdapter.get(cacheKey);
  if (cached) return cached;

  const [raw, personalization] = await Promise.all([
    expensesRepository.fetchExpensesDashboard(userId, period),
    loadPersonalization(userId),
  ]);
  const result = attachPersonalization(
    buildExpensesDashboard(raw, period),
    personalization,
    "expenses",
  );

  await cacheAdapter.set(cacheKey, result, CACHE_TTL.expenses);
  return result;
}

async function getCashflow(userId, query = {}) {
  await recurrenceService.ensureGenerated(userId);

  const period = resolvePeriod(query);
  const cacheKey = buildCacheKey(userId, "cashflow", period);
  const cached = await cacheAdapter.get(cacheKey);
  if (cached) return cached;

  const [raw, personalization] = await Promise.all([
    cashflowRepository.fetchCashflowDashboard(userId, period),
    loadPersonalization(userId),
  ]);
  const result = attachPersonalization(
    buildCashflowDashboard(raw, period),
    personalization,
    "cashflow",
  );

  await cacheAdapter.set(cacheKey, result, CACHE_TTL.cashflow);
  return result;
}

async function getCards(userId, query = {}) {
  await recurrenceService.ensureGenerated(userId);

  const period = resolvePeriod(query);
  const cacheKey = buildCacheKey(userId, "cards", period);
  const cached = await cacheAdapter.get(cacheKey);
  if (cached) return cached;

  const [raw, personalization] = await Promise.all([
    cardsRepository.fetchCardsDashboard(userId, period),
    loadPersonalization(userId),
  ]);
  const result = attachPersonalization(
    buildCardsDashboard(raw, period),
    personalization,
    "cards",
  );

  await cacheAdapter.set(cacheKey, result, CACHE_TTL.cards);
  return result;
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
