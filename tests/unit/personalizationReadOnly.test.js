import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function mockRepositoryReads() {
  const repository = require("../../backend/src/modules/personalization/personalization.repository");
  const cache = require("../../backend/src/modules/personalization/cache/personalization.cache");

  vi.spyOn(cache, "get").mockResolvedValue(null);
  vi.spyOn(cache, "set").mockResolvedValue(undefined);
  vi.spyOn(cache, "invalidate").mockResolvedValue(undefined);

  vi.spyOn(repository, "findProfile").mockResolvedValue({
    id: "p1",
    userId: USER_A,
    profileType: "equilibrado",
    incomeSource: "salario",
    monthlyIncome: 5000,
    allocation: {
      contas: 50,
      investimentos: 20,
      metas: 10,
      lazer: 10,
      desenvolvimento: 10,
    },
    notifications: [],
    onboardingCompleted: true,
  });

  vi.spyOn(repository, "getMonthSnapshot").mockResolvedValue({
    income: 5000,
    expenses: 3000,
    investedExpenses: 0,
    goals: [],
    pendingBills: [],
    cards: [],
    portfolio: 1000,
    investedCapital: 800,
  });

  vi.spyOn(repository, "getSpendingByCategory").mockResolvedValue([
    { category: "Moradia", total: 1500 },
    { category: "Lazer", total: 200 },
  ]);

  vi.spyOn(repository, "listBudgetRules").mockResolvedValue([
    {
      id: "b1",
      key: "contas",
      label: "Contas",
      percent: 50,
      limit: 2500,
      used: 0,
      remaining: 2500,
      usagePercent: 0,
      color: "#0d6efd",
    },
    {
      id: "b2",
      key: "lazer",
      label: "Lazer",
      percent: 10,
      limit: 500,
      used: 0,
      remaining: 500,
      usagePercent: 0,
      color: "#20c997",
    },
  ]);

  vi.spyOn(repository, "listHealthHistory").mockResolvedValue([]);

  const upsertProfile = vi.spyOn(repository, "upsertProfile").mockResolvedValue({});
  const replaceBudgetRules = vi.spyOn(repository, "replaceBudgetRules").mockResolvedValue([]);
  const updateBudgetUsage = vi.spyOn(repository, "updateBudgetUsage").mockResolvedValue([]);
  const upsertHealthScore = vi.spyOn(repository, "upsertHealthScore").mockResolvedValue({});

  return {
    repository,
    cache,
    upsertProfile,
    replaceBudgetRules,
    updateBudgetUsage,
    upsertHealthScore,
  };
}

describe("FASE 2B — Personalization read-only", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("readContext nao executa INSERT/UPDATE/UPSERT", async () => {
    const writes = mockRepositoryReads();
    const engine = require("../../backend/src/modules/personalization/engine/PersonalizationEngine");

    const context = await engine.readContext(USER_A);

    expect(context.profile.monthlyIncome).toBe(5000);
    expect(context.progress.length).toBeGreaterThan(0);
    expect(context.health.score).toBeTypeOf("number");
    expect(context.insights).toBeDefined();
    expect(context.home.priority).toBeDefined();

    expect(writes.upsertProfile).not.toHaveBeenCalled();
    expect(writes.replaceBudgetRules).not.toHaveBeenCalled();
    expect(writes.updateBudgetUsage).not.toHaveBeenCalled();
    expect(writes.upsertHealthScore).not.toHaveBeenCalled();
  });

  it("readContext usa perfil padrao em memoria quando nao existe perfil", async () => {
    const writes = mockRepositoryReads();
    writes.repository.findProfile.mockResolvedValue(null);
    writes.repository.listBudgetRules.mockResolvedValue([]);

    const engine = require("../../backend/src/modules/personalization/engine/PersonalizationEngine");
    const context = await engine.readContext(USER_A);

    expect(context.profile.type).toBe("equilibrado");
    expect(writes.upsertProfile).not.toHaveBeenCalled();
  });

  it("rebuildContext continua persistindo em mutacao explicita", async () => {
    const writes = mockRepositoryReads();
    const engine = require("../../backend/src/modules/personalization/engine/PersonalizationEngine");

    writes.repository.listBudgetRules.mockResolvedValue([]);
    writes.replaceBudgetRules.mockResolvedValue([
      {
        key: "contas",
        label: "Contas",
        percent: 50,
        limit: 2500,
        used: 0,
        color: "#0d6efd",
      },
    ]);
    writes.updateBudgetUsage.mockResolvedValue([
      {
        key: "contas",
        label: "Contas",
        percent: 50,
        limit: 2500,
        used: 1500,
        remaining: 1000,
        usagePercent: 60,
        status: "ok",
        color: "#0d6efd",
      },
    ]);

    const context = await engine.rebuildContext(USER_A, { force: true });

    expect(context.profile.monthlyIncome).toBe(5000);
    expect(writes.replaceBudgetRules).toHaveBeenCalled();
    expect(writes.updateBudgetUsage).toHaveBeenCalled();
    expect(writes.upsertHealthScore).toHaveBeenCalled();
  });

  it("getHomeSecondary usa readContext e nao rebuildContext", async () => {
    const engine = require("../../backend/src/modules/personalization/engine/PersonalizationEngine");
    const dashboardService = require("../../backend/src/modules/dashboard/dashboard.service");
    const repository = require("../../backend/src/modules/dashboard/dashboard.repository");
    const accountsService = require("../../backend/src/modules/accounts/accounts.service");
    const cardsService = require("../../backend/src/modules/cards/cards.service");
    const movementsService = require("../../backend/src/modules/movements/movements.service");
    const goalsService = require("../../backend/src/modules/goals/goals.service");

    vi.spyOn(repository, "getFinancialSummaries").mockResolvedValue({
      summary: {
        balance: 1,
        income: 2,
        expenses: 1,
        netWorth: 3,
        investmentsTotal: 1,
      },
      previousMonth: { income: 1, expenses: 1 },
    });
    vi.spyOn(repository, "getMonthlyFlow").mockResolvedValue([]);
    vi.spyOn(repository, "getCategorySpendingComparison").mockResolvedValue([]);
    vi.spyOn(repository, "getTopIncomeThisMonth").mockResolvedValue(null);
    vi.spyOn(cardsService, "list").mockResolvedValue([]);
    vi.spyOn(movementsService, "listBills").mockResolvedValue([]);
    vi.spyOn(goalsService, "list").mockResolvedValue([]);
    vi.spyOn(accountsService, "list").mockResolvedValue([]);

    const readSpy = vi.spyOn(engine, "readContext").mockResolvedValue({
      insights: [],
      alerts: [],
      recommendations: [],
      budgets: [],
      progress: [],
      health: { score: 50, label: "Ok", factors: [] },
    });
    const rebuildSpy = vi.spyOn(engine, "rebuildContext").mockResolvedValue({});

    await dashboardService.getHomeSecondary(USER_A);

    expect(readSpy).toHaveBeenCalledWith(USER_A, { historyDays: 0 });
    expect(rebuildSpy).not.toHaveBeenCalled();
  });

  it("home secondary BFF nao dispara escritas de personalization", async () => {
    const writes = mockRepositoryReads();
    const homeBffService = require("../../backend/src/modules/bff/services/home.bff.service");
    const dashboardService = require("../../backend/src/modules/dashboard/dashboard.service");
    const CacheService = require("../../backend/src/modules/bff/cache/cache.service");

    vi.spyOn(dashboardService, "getHomeSecondary").mockImplementation(async (userId) => {
      const engine = require("../../backend/src/modules/personalization/engine/PersonalizationEngine");
      const personalization = await engine.readContext(userId);
      return {
        monthlyFlow: [],
        flowSummary: {},
        financialHealth: [],
        goals: [],
        bills: [],
        pendingBills: [],
        insights: personalization.insights || [],
        personalization,
        alerts: [],
        recommendations: [],
        budgets: personalization.budgets || [],
        progress: personalization.progress || [],
        healthScore: personalization.health || null,
        meta: { scope: "secondary", secondaryPending: false },
      };
    });

    await CacheService.invalidatePrefix("bff:");
    await homeBffService.getHomeSecondary(USER_A);

    expect(writes.upsertProfile).not.toHaveBeenCalled();
    expect(writes.replaceBudgetRules).not.toHaveBeenCalled();
    expect(writes.updateBudgetUsage).not.toHaveBeenCalled();
    expect(writes.upsertHealthScore).not.toHaveBeenCalled();
  });

  it("readContext isola usuarios no cache de memoria", async () => {
    mockRepositoryReads();
    const engine = require("../../backend/src/modules/personalization/engine/PersonalizationEngine");
    const cache = require("../../backend/src/modules/personalization/cache/personalization.cache");
    const repository = require("../../backend/src/modules/personalization/personalization.repository");

    const setSpy = vi.spyOn(cache, "set");
    repository.findProfile.mockImplementation(async (userId) => ({
      id: `p-${userId}`,
      userId,
      profileType: "equilibrado",
      incomeSource: null,
      monthlyIncome: userId === USER_A ? 5000 : 9000,
      allocation: {
        contas: 50,
        investimentos: 20,
        metas: 10,
        lazer: 10,
        desenvolvimento: 10,
      },
      notifications: [],
      onboardingCompleted: true,
    }));

    const ctxA = await engine.readContext(USER_A, { force: true });
    const ctxB = await engine.readContext(USER_B, { force: true });

    expect(ctxA.profile.monthlyIncome).toBe(5000);
    expect(ctxB.profile.monthlyIncome).toBe(9000);
    expect(setSpy).toHaveBeenCalledWith(USER_A, expect.any(Object), "context");
    expect(setSpy).toHaveBeenCalledWith(USER_B, expect.any(Object), "context");
  });
});
