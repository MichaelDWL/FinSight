const recurrenceService = require("../../services/recurrenceService");
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

async function getGeneral(userId, query = {}) {
  await recurrenceService.ensureGenerated(userId);

  const period = resolvePeriod(query);
  const cacheKey = buildCacheKey(userId, "general", period);
  const cached = await cacheAdapter.get(cacheKey);
  if (cached) return cached;

  const raw = await generalRepository.fetchGeneralDashboard(userId, period);
  const result = buildGeneralDashboard(raw, period);

  await cacheAdapter.set(cacheKey, result, CACHE_TTL.general);
  return result;
}

async function getExpenses(userId, query = {}) {
  await recurrenceService.ensureGenerated(userId);

  const period = resolvePeriod(query);
  const cacheKey = buildCacheKey(userId, "expenses", period);
  const cached = await cacheAdapter.get(cacheKey);
  if (cached) return cached;

  const raw = await expensesRepository.fetchExpensesDashboard(userId, period);
  const result = buildExpensesDashboard(raw, period);

  await cacheAdapter.set(cacheKey, result, CACHE_TTL.expenses);
  return result;
}

async function getCashflow(userId, query = {}) {
  await recurrenceService.ensureGenerated(userId);

  const period = resolvePeriod(query);
  const cacheKey = buildCacheKey(userId, "cashflow", period);
  const cached = await cacheAdapter.get(cacheKey);
  if (cached) return cached;

  const raw = await cashflowRepository.fetchCashflowDashboard(userId, period);
  const result = buildCashflowDashboard(raw, period);

  await cacheAdapter.set(cacheKey, result, CACHE_TTL.cashflow);
  return result;
}

async function getCards(userId, query = {}) {
  await recurrenceService.ensureGenerated(userId);

  const period = resolvePeriod(query);
  const cacheKey = buildCacheKey(userId, "cards", period);
  const cached = await cacheAdapter.get(cacheKey);
  if (cached) return cached;

  const raw = await cardsRepository.fetchCardsDashboard(userId, period);
  const result = buildCardsDashboard(raw, period);

  await cacheAdapter.set(cacheKey, result, CACHE_TTL.cards);
  return result;
}

async function getInvestments(userId, query = {}) {
  const period = resolvePeriod(query);
  const cacheKey = buildCacheKey(userId, "investments", period);
  const cached = await cacheAdapter.get(cacheKey);
  if (cached) return cached;

  const raw = await investmentsRepository.fetchInvestmentsDashboard(userId, period);
  const result = buildInvestmentsDashboard(raw, period);

  await cacheAdapter.set(cacheKey, result, CACHE_TTL.investments);
  return result;
}

module.exports = { getGeneral, getExpenses, getCashflow, getCards, getInvestments };
