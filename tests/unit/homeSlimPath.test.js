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

function mockHomeCoreDeps() {
  const dashboardService = require("../../backend/src/modules/dashboard/dashboard.service");
  const repository = require("../../backend/src/modules/dashboard/dashboard.repository");
  const accountsService = require("../../backend/src/modules/accounts/accounts.service");
  const cardsService = require("../../backend/src/modules/cards/cards.service");
  const movementsService = require("../../backend/src/modules/movements/movements.service");
  const goalsService = require("../../backend/src/modules/goals/goals.service");
  const investmentsService = require("../../backend/src/modules/investments/investments.service");
  const personalizationEngine = require("../../backend/src/modules/personalization/engine/PersonalizationEngine");
  const recurrenceService = require("../../backend/src/services/recurrence.service");

  vi.spyOn(repository, "getFinancialSummaries").mockResolvedValue(emptyFinancial);
  vi.spyOn(repository, "getHomeSecondaryBundle").mockResolvedValue({
    financial: emptyFinancial,
    categoryComparison: [],
    topIncome: null,
  });
  vi.spyOn(repository, "getMonthlyFlow").mockResolvedValue([{ month: "Aug", income: 1, expenses: 1, balance: 0 }]);
  vi.spyOn(repository, "getCategorySpendingComparison").mockResolvedValue([]);
  vi.spyOn(repository, "getTopIncomeThisMonth").mockResolvedValue(null);
  vi.spyOn(repository, "getCurrentMonthInvoices").mockResolvedValue([]);
  vi.spyOn(movementsService, "listTransactions").mockResolvedValue([
    { id: "t1", description: "Cafe", value: -10 },
  ]);
  vi.spyOn(movementsService, "listBills").mockResolvedValue([]);
  vi.spyOn(accountsService, "list").mockResolvedValue([
    { id: "a1", balance: 800, type: "corrente" },
  ]);
  vi.spyOn(accountsService, "listSummary").mockResolvedValue([
    { id: "a1", balance: 800, type: "corrente", name: "Nubank", status: "ativa" },
  ]);
  vi.spyOn(cardsService, "list").mockResolvedValue([
    { id: "c1", totalLimit: 1000, usedLimit: 200, dueDay: 10, name: "Visa" },
  ]);
  vi.spyOn(investmentsService, "list").mockResolvedValue([{ id: "i1", current: 5000 }]);
  vi.spyOn(goalsService, "list").mockResolvedValue([{ id: "g1", name: "Viagem", current: 100, desired: 1000 }]);
  vi.spyOn(personalizationEngine, "rebuildContext").mockResolvedValue({
    insights: [{ icon: "fa-lightbulb", tone: "neutral", text: "Insight personalizado" }],
    alerts: [],
    recommendations: [],
    budgets: [],
    progress: [{ label: "Essenciais", used: 10, limit: 100, usagePercent: 10, remaining: 90 }],
    health: { score: 72, label: "Bom", factors: [] },
    home: { spotlight: null, priority: ["balance"] },
    profile: { title: "Equilibrado" },
  });
  vi.spyOn(personalizationEngine, "readContext").mockResolvedValue({
    insights: [{ icon: "fa-lightbulb", tone: "neutral", text: "Insight personalizado" }],
    alerts: [],
    recommendations: [],
    budgets: [],
    progress: [{ label: "Essenciais", used: 10, limit: 100, usagePercent: 10, remaining: 90 }],
    health: { score: 72, label: "Bom", factors: [] },
    home: { spotlight: null, priority: ["balance"] },
    profile: { title: "Equilibrado" },
  });
  vi.spyOn(recurrenceService, "ensureGenerated").mockResolvedValue(0);
  vi.spyOn(recurrenceService, "syncRecurringTransactions").mockResolvedValue(0);

  return {
    dashboardService,
    repository,
    movementsService,
    investmentsService,
    personalizationEngine,
    recurrenceService,
    goalsService,
  };
}

describe("FASE 2B — Home enxuta (caminho critico)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getHomeCore retorna KPIs essenciais sem personalization nem graficos", async () => {
    const { dashboardService, personalizationEngine, investmentsService, goalsService } =
      mockHomeCoreDeps();

    const core = await dashboardService.getHomeCore(USER_A);

    expect(core.balance).toBe(1000);
    expect(core.income).toBe(5000);
    expect(core.expenses).toBe(4000);
    expect(core.netWorth).toBe(15000);
    expect(core.trends).toBeTruthy();
    expect(core.wealthBreakdown).toBeTruthy();
    expect(core.transactions).toHaveLength(1);
    expect(core.accounts).toHaveLength(1);
    expect(core.cards).toHaveLength(1);
    expect(core.meta.scope).toBe("core");
    expect(core.meta.secondaryPending).toBe(true);
    expect(core.monthlyFlow).toEqual([]);
    expect(core.personalization).toBeNull();
    expect(core.goals).toEqual([]);
    expect(personalizationEngine.rebuildContext).not.toHaveBeenCalled();
    expect(investmentsService.list).not.toHaveBeenCalled();
    expect(goalsService.list).not.toHaveBeenCalled();
  });

  it("getHomeCore usa listSummary e nao list completo de accounts", async () => {
    const accountsService = require("../../backend/src/modules/accounts/accounts.service");
    mockHomeCoreDeps();
    const listSpy = vi.spyOn(accountsService, "list");
    const summarySpy = vi.spyOn(accountsService, "listSummary").mockResolvedValue([
      { id: "a1", balance: 800, type: "corrente" },
    ]);

    const dashboardService = require("../../backend/src/modules/dashboard/dashboard.service");
    await dashboardService.getHomeCore(USER_A);

    expect(summarySpy).toHaveBeenCalledWith(USER_A);
    expect(listSpy).not.toHaveBeenCalled();
  });

  it("getHomeSecondary carrega graficos, metas e personalization", async () => {
    const { dashboardService, personalizationEngine, goalsService } = mockHomeCoreDeps();

    const secondary = await dashboardService.getHomeSecondary(USER_A);

    expect(secondary.monthlyFlow).toHaveLength(1);
    expect(secondary.goals).toHaveLength(1);
    expect(secondary.insights.length).toBeGreaterThan(0);
    expect(secondary.healthScore?.score).toBe(72);
    expect(secondary.meta.scope).toBe("secondary");
    expect(personalizationEngine.readContext).toHaveBeenCalledWith(USER_A, { historyDays: 0 });
    expect(personalizationEngine.rebuildContext).not.toHaveBeenCalled();
    expect(goalsService.list).toHaveBeenCalledWith(USER_A);
  });

  it("home BFF core nao chama getDashboard nem rebuildContext", async () => {
    const deps = mockHomeCoreDeps();
    const homeBffService = require("../../backend/src/modules/bff/services/home.bff.service");
    const CacheService = require("../../backend/src/modules/bff/cache/cache.service");

    vi.spyOn(deps.dashboardService, "getDashboard");
    await CacheService.invalidatePrefix("bff:");

    const { data } = await homeBffService.getHome(
      USER_A,
      {},
      {
        reqUser: {
          id: USER_A,
          name: "Test",
          email: "test@test.com",
          role: "user",
          status: "active",
        },
      },
    );

    expect(deps.dashboardService.getDashboard).not.toHaveBeenCalled();
    expect(deps.personalizationEngine.rebuildContext).not.toHaveBeenCalled();
    expect(deps.recurrenceService.ensureGenerated).not.toHaveBeenCalled();
    expect(data.balance).toBe(1000);
    expect(data.summary.balance).toBe(1000);
    expect(data.meta.scope).toBe("core");
    expect(data.user.id).toBe(USER_A);
  });

  it("home secondary BFF isola usuarios no cache", async () => {
    mockHomeCoreDeps();
    const homeBffService = require("../../backend/src/modules/bff/services/home.bff.service");
    const CacheService = require("../../backend/src/modules/bff/cache/cache.service");
    await CacheService.invalidatePrefix("bff:");

    const keyA = CacheService.buildKey("home-secondary", USER_A);
    const keyB = CacheService.buildKey("home-secondary", USER_B);
    expect(keyA).not.toBe(keyB);

    await homeBffService.getHomeSecondary(USER_A);
    await homeBffService.getHomeSecondary(USER_B);

    await expect(CacheService.get(keyA)).resolves.toBeTruthy();
    await expect(CacheService.get(keyB)).resolves.toBeTruthy();

    await CacheService.invalidateUser(USER_A);
    await expect(CacheService.get(keyA)).resolves.toBeNull();
    await expect(CacheService.get(keyB)).resolves.toBeTruthy();
  });

  it("getHomeCore nao gera recorrencias nem abre writes de personalization", async () => {
    const { dashboardService, recurrenceService, personalizationEngine, movementsService } =
      mockHomeCoreDeps();

    await dashboardService.getHomeCore(USER_A);

    expect(recurrenceService.ensureGenerated).not.toHaveBeenCalled();
    expect(recurrenceService.syncRecurringTransactions).not.toHaveBeenCalled();
    expect(personalizationEngine.rebuildContext).not.toHaveBeenCalled();
    expect(movementsService.listTransactions).toHaveBeenCalledWith(
      USER_A,
      expect.objectContaining({ pageSize: 6 }),
    );
  });

  it("listTransactions do core usa pageSize 6 (nao 50)", async () => {
    const { dashboardService, movementsService } = mockHomeCoreDeps();
    await dashboardService.getHomeCore(USER_A);
    expect(movementsService.listTransactions).toHaveBeenCalledWith(
      USER_A,
      expect.objectContaining({ pageSize: 6, asArray: true }),
    );
  });
});
