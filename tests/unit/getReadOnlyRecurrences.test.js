import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const emptyFinancial = {
  summary: {
    balance: 1000,
    income: 5000,
    expenses: 4000,
    netWorth: 15000,
    investmentsTotal: 5000,
  },
  previousMonth: { income: 4800, expenses: 3900 },
};

function mockDashboardDependencies() {
  const recurrenceService = require("../../backend/src/services/recurrence.service");
  const dashboardService = require("../../backend/src/modules/dashboard/dashboard.service");
  const repository = require("../../backend/src/modules/dashboard/dashboard.repository");
  const accountsService = require("../../backend/src/modules/accounts/accounts.service");
  const cardsService = require("../../backend/src/modules/cards/cards.service");
  const goalsService = require("../../backend/src/modules/goals/goals.service");
  const investmentsService = require("../../backend/src/modules/investments/investments.service");
  const movementsService = require("../../backend/src/modules/movements/movements.service");
  const personalizationEngine = require("../../backend/src/modules/personalization/engine/PersonalizationEngine");

  vi.spyOn(recurrenceService, "ensureGenerated").mockResolvedValue(99);
  vi.spyOn(recurrenceService, "syncRecurringTransactions").mockResolvedValue(99);

  vi.spyOn(repository, "getFinancialSummaries").mockResolvedValue(emptyFinancial);
  vi.spyOn(repository, "getMonthlyFlow").mockResolvedValue([]);
  vi.spyOn(repository, "getCategorySpendingComparison").mockResolvedValue([]);
  vi.spyOn(repository, "getTopIncomeThisMonth").mockResolvedValue(null);
  vi.spyOn(repository, "getCurrentMonthInvoices").mockResolvedValue([]);
  vi.spyOn(movementsService, "listTransactions").mockResolvedValue([]);
  vi.spyOn(movementsService, "listBills").mockResolvedValue([]);
  vi.spyOn(accountsService, "list").mockResolvedValue([]);
  vi.spyOn(cardsService, "list").mockResolvedValue([]);
  vi.spyOn(investmentsService, "list").mockResolvedValue([]);
  vi.spyOn(goalsService, "list").mockResolvedValue([]);
  vi.spyOn(personalizationEngine, "rebuildContext").mockResolvedValue(null);
  vi.spyOn(personalizationEngine, "readContext").mockResolvedValue(null);

  return { recurrenceService, dashboardService };
}

describe("FASE 2B — GET somente leitura (recorrencias)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getDashboard nao chama ensureGenerated nem syncRecurringTransactions", async () => {
    const { recurrenceService, dashboardService } = mockDashboardDependencies();

    const result = await dashboardService.getDashboard(USER_A);

    expect(recurrenceService.ensureGenerated).not.toHaveBeenCalled();
    expect(recurrenceService.syncRecurringTransactions).not.toHaveBeenCalled();
    expect(result.balance).toBe(1000);
    expect(result.monthlyBalance).toBe(1000);
  });

  it("withCachedDashboard (analytics) nao chama ensureGenerated em cache miss", async () => {
    const recurrenceService = require("../../backend/src/services/recurrence.service");
    const analyticsService = require("../../backend/src/modules/analytics/analytics.service");
    const generalRepository = require("../../backend/src/modules/analytics/repositories/general.analytics");
    const { cacheAdapter, initCache } = require("../../backend/src/modules/analytics/analytics.cache");
    const personalizationEngine = require("../../backend/src/modules/personalization/engine/PersonalizationEngine");

    await initCache();
    await cacheAdapter.invalidateUser(USER_A);

    vi.spyOn(recurrenceService, "ensureGenerated").mockResolvedValue(99);
    vi.spyOn(recurrenceService, "syncRecurringTransactions").mockResolvedValue(99);
    vi.spyOn(generalRepository, "fetchGeneralDashboard").mockResolvedValue({
      kpis: { balance: 200 },
    });
    vi.spyOn(personalizationEngine, "rebuildContext").mockResolvedValue(null);
  vi.spyOn(personalizationEngine, "readContext").mockResolvedValue(null);

    await analyticsService.getGeneral(USER_A, { period: "30d" });

    expect(recurrenceService.ensureGenerated).not.toHaveBeenCalled();
    expect(recurrenceService.syncRecurringTransactions).not.toHaveBeenCalled();
  });

  it("home BFF nao dispara geracao de recorrencias", async () => {
    const recurrenceService = require("../../backend/src/services/recurrence.service");
    const dashboardService = require("../../backend/src/modules/dashboard/dashboard.service");
    const homeBffService = require("../../backend/src/modules/bff/services/home.bff.service");

    vi.spyOn(recurrenceService, "ensureGenerated").mockResolvedValue(99);
    vi.spyOn(recurrenceService, "syncRecurringTransactions").mockResolvedValue(99);
    vi.spyOn(dashboardService, "getHomeCore").mockResolvedValue({
      balance: 1000,
      income: 5000,
      expenses: 4000,
      netWorth: 15000,
      investmentsTotal: 5000,
      monthlyBalance: 1000,
      trends: {},
      wealthBreakdown: {},
      accounts: [],
      cards: [],
      latestTransactions: [],
      transactions: [],
      investments: [],
      goals: [],
      bills: [],
      pendingBills: [],
      monthlyFlow: [],
      flowSummary: {},
      currentInvoices: [],
      financialHealth: [],
      insights: [],
      personalization: null,
      alerts: [],
      recommendations: [],
      budgets: [],
      progress: [],
      healthScore: null,
      meta: { scope: "core", secondaryPending: true },
    });

    const CacheService = require("../../backend/src/modules/bff/cache/cache.service");
    await CacheService.invalidatePrefix("bff:");

    await homeBffService.getHome(USER_A, {}, {
      reqUser: {
        id: USER_A,
        name: "Test",
        email: "test@test.com",
        role: "user",
        status: "active",
      },
    });

    expect(recurrenceService.ensureGenerated).not.toHaveBeenCalled();
    expect(recurrenceService.syncRecurringTransactions).not.toHaveBeenCalled();
  });

  it("insights BFF nao dispara geracao de recorrencias", async () => {
    const { recurrenceService } = mockDashboardDependencies();
    const insightsBffService = require("../../backend/src/modules/bff/services/insights.bff.service");
    const goalsService = require("../../backend/src/modules/goals/goals.service");
    const personalizationEngine = require("../../backend/src/modules/personalization/engine/PersonalizationEngine");

    vi.spyOn(personalizationEngine, "rebuildContext").mockResolvedValue({ alerts: [] });
    vi.spyOn(personalizationEngine, "readContext").mockResolvedValue({ alerts: [] });
    vi.spyOn(goalsService, "list").mockResolvedValue([]);

    const CacheService = require("../../backend/src/modules/bff/cache/cache.service");
    await CacheService.invalidatePrefix("bff:");

    await insightsBffService.getInsights(USER_A, {}, {
      reqUser: {
        id: USER_A,
        name: "Test",
        email: "test@test.com",
        role: "user",
        status: "active",
      },
    });

    expect(recurrenceService.ensureGenerated).not.toHaveBeenCalled();
    expect(recurrenceService.syncRecurringTransactions).not.toHaveBeenCalled();
  });

  it("dashboard BFF (analytics) nao dispara geracao de recorrencias", async () => {
    const recurrenceService = require("../../backend/src/services/recurrence.service");
    const analyticsService = require("../../backend/src/modules/analytics/analytics.service");
    const dashboardBffService = require("../../backend/src/modules/bff/services/dashboard.bff.service");

    vi.spyOn(recurrenceService, "ensureGenerated").mockResolvedValue(99);
    vi.spyOn(recurrenceService, "syncRecurringTransactions").mockResolvedValue(99);
    vi.spyOn(analyticsService, "getGeneral").mockResolvedValue({ kpis: {} });
    vi.spyOn(analyticsService, "getExpenses").mockResolvedValue({});
    vi.spyOn(analyticsService, "getCashflow").mockResolvedValue({});
    vi.spyOn(analyticsService, "getCards").mockResolvedValue({});
    vi.spyOn(analyticsService, "getInvestments").mockResolvedValue({});

    const CacheService = require("../../backend/src/modules/bff/cache/cache.service");
    await CacheService.invalidatePrefix("bff:");

    await dashboardBffService.getDashboard(USER_A, { period: "30d" }, {
      reqUser: {
        id: USER_A,
        name: "Test",
        email: "test@test.com",
        role: "user",
        status: "active",
      },
    });

    expect(recurrenceService.ensureGenerated).not.toHaveBeenCalled();
    expect(recurrenceService.syncRecurringTransactions).not.toHaveBeenCalled();
  });

  it("syncRecurringTransactions executa generate dentro de transacao", async () => {
    vi.restoreAllMocks();

    const recurrenceService = require("../../backend/src/services/recurrence.service");
    const pool = require("../../backend/src/database/pool");

    const clientQuery = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [{ limite: "2026-08-31" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce(undefined);

    vi.spyOn(pool, "connect").mockResolvedValue({
      query: clientQuery,
      release: vi.fn(),
    });

    recurrenceService.invalidateEnsureGenerated(USER_A);

    const generated = await recurrenceService.syncRecurringTransactions(USER_A);

    expect(generated).toBe(0);
    expect(clientQuery).toHaveBeenCalledWith("BEGIN");
    expect(clientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("syncRecurringTransactions isola usuarios (dedup por userId)", async () => {
    vi.restoreAllMocks();

    const recurrenceService = require("../../backend/src/services/recurrence.service");
    const pool = require("../../backend/src/database/pool");

    let connectCount = 0;
    vi.spyOn(pool, "connect").mockImplementation(async () => {
      connectCount += 1;
      const clientQuery = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ limite: "2026-08-31" }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce(undefined);

      return { query: clientQuery, release: vi.fn() };
    });

    recurrenceService.invalidateEnsureGenerated(USER_A);
    recurrenceService.invalidateEnsureGenerated(USER_B);

    await Promise.all([
      recurrenceService.syncRecurringTransactions(USER_A),
      recurrenceService.syncRecurringTransactions(USER_B),
    ]);

    expect(connectCount).toBe(2);
  });

  it("GET paths nao abrem withTransaction para recorrencias", async () => {
    const transactionModule = require("../../backend/src/database/transaction");
    const withTransactionSpy = vi.spyOn(transactionModule, "withTransaction");

    mockDashboardDependencies();
    const dashboardService = require("../../backend/src/modules/dashboard/dashboard.service");
    const analyticsService = require("../../backend/src/modules/analytics/analytics.service");
    const generalRepository = require("../../backend/src/modules/analytics/repositories/general.analytics");
    const { cacheAdapter, initCache } = require("../../backend/src/modules/analytics/analytics.cache");
    const personalizationEngine = require("../../backend/src/modules/personalization/engine/PersonalizationEngine");

    await initCache();
    await cacheAdapter.invalidateUser(USER_A);
    vi.spyOn(generalRepository, "fetchGeneralDashboard").mockResolvedValue({ kpis: {} });
    vi.spyOn(personalizationEngine, "rebuildContext").mockResolvedValue(null);
  vi.spyOn(personalizationEngine, "readContext").mockResolvedValue(null);

    await dashboardService.getDashboard(USER_A);
    await analyticsService.getGeneral(USER_A, { period: "30d" });

    expect(withTransactionSpy).not.toHaveBeenCalled();
  });
});
