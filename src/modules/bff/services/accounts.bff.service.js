const accountsService = require("../../accounts/accounts.service");
const movementsService = require("../../movements/movements.service");
const invoicesService = require("../../invoices/invoices.service");
const usersService = require("../../users/users.service");
const dashboardRepository = require("../../dashboard/dashboard.repository");
const CacheService = require("../cache/cache.service");
const { BFF_CACHE_TTL } = require("../bff.constants");
const { parallel } = require("../utils/parallel");

/**
 * AccountsBFFService — tela de contas em uma chamada.
 */
async function buildAccounts(userId) {
  const result = await parallel({
    user: () => usersService.getProfile(userId),
    accounts: () => accountsService.list(userId),
    bills: { fn: () => movementsService.listBills(userId), optional: true, fallback: [] },
    invoices: {
      fn: () => invoicesService.listCurrent(userId),
      optional: true,
      fallback: [],
    },
    transactions: {
      fn: () => movementsService.listTransactions(userId),
      optional: true,
      fallback: [],
    },
    summary: {
      fn: () => dashboardRepository.getFinancialSummary(userId),
      optional: true,
      fallback: null,
    },
    monthlyFlow: {
      fn: () => dashboardRepository.getMonthlyFlow(userId, 6),
      optional: true,
      fallback: [],
    },
  });

  const accounts = result.accounts || [];
  const transactions = result.transactions || [];
  const bills = result.bills || [];

  const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
  const income = Number(result.summary?.income || 0);
  const expenses = Number(result.summary?.expenses || 0);

  const transfers = transactions
    .filter((tx) => String(tx.type || "").toLowerCase().includes("transfer"))
    .slice(0, 10);

  const recentByAccount = {};
  for (const tx of transactions.slice(0, 40)) {
    const accountId = tx.accountId || tx.account_id;
    if (!accountId) continue;
    if (!recentByAccount[accountId]) recentByAccount[accountId] = [];
    if (recentByAccount[accountId].length < 5) {
      recentByAccount[accountId].push(tx);
    }
  }

  return {
    user: result.user,
    accounts,
    balance: {
      total: Math.round(totalBalance * 100) / 100,
      byAccount: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        balance: account.balance,
      })),
    },
    statement: {
      recent: transactions.slice(0, 20),
      byAccount: recentByAccount,
    },
    income,
    expenses,
    monthlySummary: {
      income,
      expenses,
      balance: Math.round((income - expenses) * 100) / 100,
      pendingBills: bills.filter((bill) => bill.status !== "paid").length,
    },
    chart: {
      monthlyFlow: result.monthlyFlow || [],
    },
    recentTransfers: transfers,
    bills,
    invoices: result.invoices || [],
  };
}

async function getAccounts(userId) {
  const cacheKey = CacheService.buildKey("accounts", userId);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL.accounts,
    () => buildAccounts(userId),
  );

  return { data, cacheHit };
}

module.exports = { getAccounts, buildAccounts };
