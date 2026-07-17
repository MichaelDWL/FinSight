const movementsService = require("../../movements/movements.service");
const accountsService = require("../../accounts/accounts.service");
const usersService = require("../../users/users.service");
const dashboardRepository = require("../../dashboard/dashboard.repository");
const CacheService = require("../cache/cache.service");
const { BFF_CACHE_TTL } = require("../bff.constants");
const { parallel } = require("../utils/parallel");

/**
 * TransactionsBFFService — lista + filtros + resumo + graficos.
 */
async function buildTransactions(userId) {
  const result = await parallel({
    user: () => usersService.getProfile(userId),
    transactions: () => movementsService.listTransactions(userId, { pageSize: 100, asArray: true }),
    accounts: { fn: () => accountsService.list(userId), optional: true, fallback: [] },
    categoryComparison: {
      fn: () => dashboardRepository.getCategorySpendingComparison(userId),
      optional: true,
      fallback: [],
    },
    monthlyFlow: {
      fn: () => dashboardRepository.getMonthlyFlow(userId, 6),
      optional: true,
      fallback: [],
    },
    summary: {
      fn: () => dashboardRepository.getFinancialSummary(userId),
      optional: true,
      fallback: null,
    },
  });

  const transactions = result.transactions || [];
  const categoriesMap = new Map();

  for (const tx of transactions) {
    const name = tx.category || tx.categoryName || "Sem categoria";
    const current = categoriesMap.get(name) || { name, count: 0, total: 0 };
    current.count += 1;
    current.total += Number(tx.value || tx.amount || 0);
    categoriesMap.set(name, current);
  }

  const categories = [...categoriesMap.values()].sort((a, b) => b.total - a.total);

  const types = [...new Set(transactions.map((tx) => tx.type).filter(Boolean))];
  const statuses = [...new Set(transactions.map((tx) => tx.status).filter(Boolean))];

  const income = transactions
    .filter((tx) => String(tx.type || "").includes("receita") || Number(tx.value) > 0)
    .reduce((sum, tx) => sum + Math.abs(Number(tx.value || 0)), 0);

  const expense = transactions
    .filter((tx) => !String(tx.type || "").includes("receita"))
    .reduce((sum, tx) => sum + Math.abs(Number(tx.value || 0)), 0);

  return {
    user: result.user,
    list: transactions,
    categories,
    filters: {
      types,
      statuses,
      accounts: (result.accounts || []).map((account) => ({
        id: account.id,
        name: account.name,
      })),
      categoryNames: categories.map((item) => item.name),
    },
    summary: {
      count: transactions.length,
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expense * 100) / 100,
      balance: Math.round((income - expense) * 100) / 100,
      monthIncome: result.summary?.income ?? null,
      monthExpenses: result.summary?.expenses ?? null,
    },
    chart: {
      monthlyFlow: result.monthlyFlow || [],
      categoryComparison: result.categoryComparison || [],
      categories: categories.slice(0, 8),
    },
    statistics: {
      avgTicket:
        transactions.length > 0
          ? Math.round((expense / Math.max(transactions.length, 1)) * 100) / 100
          : 0,
      topCategory: categories[0] || null,
      byType: types.map((type) => ({
        type,
        count: transactions.filter((tx) => tx.type === type).length,
      })),
    },
    accounts: result.accounts || [],
  };
}

async function getTransactions(userId) {
  const cacheKey = CacheService.buildKey("transactions", userId);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL.transactions,
    () => buildTransactions(userId),
  );

  return { data, cacheHit };
}

module.exports = { getTransactions, buildTransactions };
