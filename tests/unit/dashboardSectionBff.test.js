import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const reqUser = {
  id: USER_A,
  name: "Test",
  email: "test@test.com",
  role: "user",
  status: "active",
};

function mockAnalyticsPanels() {
  const analyticsService = require("../../backend/src/modules/analytics/analytics.service");
  const accountsService = require("../../backend/src/modules/accounts/accounts.service");
  const cardsService = require("../../backend/src/modules/cards/cards.service");
  const goalsService = require("../../backend/src/modules/goals/goals.service");
  const recurrenceService = require("../../backend/src/services/recurrence.service");

  const general = vi.spyOn(analyticsService, "getGeneral").mockResolvedValue({
    kpis: { balance: 100 },
    personalization: { alerts: [] },
  });
  const expenses = vi.spyOn(analyticsService, "getExpenses").mockResolvedValue({
    charts: { byCategory: [] },
  });
  const cashflow = vi.spyOn(analyticsService, "getCashflow").mockResolvedValue({
    charts: { monthlyFlow: [] },
  });
  const cards = vi.spyOn(analyticsService, "getCards").mockResolvedValue({
    charts: { limitUsage: [] },
  });
  const investments = vi.spyOn(analyticsService, "getInvestments").mockResolvedValue({
    charts: { distribution: [] },
  });

  vi.spyOn(accountsService, "list").mockResolvedValue([{ id: "a1" }]);
  vi.spyOn(cardsService, "list").mockResolvedValue([{ id: "c1" }]);
  vi.spyOn(goalsService, "list").mockResolvedValue([{ id: "g1" }]);
  vi.spyOn(recurrenceService, "ensureGenerated").mockResolvedValue(0);
  vi.spyOn(recurrenceService, "syncRecurringTransactions").mockResolvedValue(0);

  return { general, expenses, cashflow, cards, investments, recurrenceService, accountsService };
}

describe("FASE 2B — Dashboard BFF por section", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    const CacheService = require("../../backend/src/modules/bff/cache/cache.service");
    await CacheService.invalidatePrefix("bff:");
  });

  it("normalizeSection aceita apenas secoes validas", () => {
    const { normalizeSection } = require("../../backend/src/modules/bff/services/dashboard.bff.service");
    expect(normalizeSection("general")).toBe("general");
    expect(normalizeSection("EXPENSES")).toBe("expenses");
    expect(normalizeSection("invalid")).toBeNull();
    expect(normalizeSection("")).toBeNull();
  });

  it("com section=general carrega apenas getGeneral", async () => {
    const spies = mockAnalyticsPanels();
    const dashboardBffService = require("../../backend/src/modules/bff/services/dashboard.bff.service");

    const { data } = await dashboardBffService.getDashboard(
      USER_A,
      { period: "30d", section: "general" },
      { reqUser },
    );

    expect(spies.general).toHaveBeenCalledTimes(1);
    expect(spies.expenses).not.toHaveBeenCalled();
    expect(spies.cashflow).not.toHaveBeenCalled();
    expect(spies.cards).not.toHaveBeenCalled();
    expect(spies.investments).not.toHaveBeenCalled();
    expect(spies.accountsService.list).not.toHaveBeenCalled();
    expect(data.meta.scope).toBe("section");
    expect(data.meta.section).toBe("general");
    expect(data.sections.general.kpis.balance).toBe(100);
    expect(data.sections.expenses).toBeUndefined();
  });

  it("com section=investments carrega apenas getInvestments", async () => {
    const spies = mockAnalyticsPanels();
    const dashboardBffService = require("../../backend/src/modules/bff/services/dashboard.bff.service");

    const { data } = await dashboardBffService.getDashboard(
      USER_A,
      { period: "90d", section: "investments" },
      { reqUser },
    );

    expect(spies.investments).toHaveBeenCalledTimes(1);
    expect(spies.general).not.toHaveBeenCalled();
    expect(data.sections.investments.charts.distribution).toEqual([]);
    expect(data.meta.section).toBe("investments");
  });

  it("sem section mantem payload completo (compatibilidade)", async () => {
    const spies = mockAnalyticsPanels();
    const dashboardBffService = require("../../backend/src/modules/bff/services/dashboard.bff.service");

    const { data } = await dashboardBffService.getDashboard(
      USER_A,
      { period: "30d" },
      { reqUser },
    );

    expect(spies.general).toHaveBeenCalled();
    expect(spies.expenses).toHaveBeenCalled();
    expect(spies.cashflow).toHaveBeenCalled();
    expect(spies.cards).toHaveBeenCalled();
    expect(spies.investments).toHaveBeenCalled();
    expect(spies.accountsService.list).toHaveBeenCalled();
    expect(data.meta.scope).toBe("full");
    expect(data.sections.general).toBeTruthy();
    expect(data.sections.expenses).toBeTruthy();
    expect(data.accounts).toHaveLength(1);
  });

  it("section mode nao dispara escrita de recorrencias", async () => {
    const spies = mockAnalyticsPanels();
    const dashboardBffService = require("../../backend/src/modules/bff/services/dashboard.bff.service");

    await dashboardBffService.getDashboard(
      USER_A,
      { period: "30d", section: "expenses" },
      { reqUser },
    );

    expect(spies.recurrenceService.ensureGenerated).not.toHaveBeenCalled();
    expect(spies.recurrenceService.syncRecurringTransactions).not.toHaveBeenCalled();
  });

  it("cache isola usuarios e secoes", async () => {
    mockAnalyticsPanels();
    const dashboardBffService = require("../../backend/src/modules/bff/services/dashboard.bff.service");
    const CacheService = require("../../backend/src/modules/bff/cache/cache.service");

    const keyA = CacheService.buildKey("dashboard", USER_A, "30d:general");
    const keyB = CacheService.buildKey("dashboard", USER_B, "30d:general");
    const keyExpenses = CacheService.buildKey("dashboard", USER_A, "30d:expenses");

    expect(keyA).not.toBe(keyB);
    expect(keyA).not.toBe(keyExpenses);

    await dashboardBffService.getDashboard(USER_A, { period: "30d", section: "general" }, { reqUser });
    await dashboardBffService.getDashboard(
      USER_B,
      { period: "30d", section: "general" },
      { reqUser: { ...reqUser, id: USER_B, email: "b@test.com" } },
    );

    await expect(CacheService.get(keyA)).resolves.toBeTruthy();
    await expect(CacheService.get(keyB)).resolves.toBeTruthy();

    await CacheService.invalidateUser(USER_A);
    await expect(CacheService.get(keyA)).resolves.toBeNull();
    await expect(CacheService.get(keyB)).resolves.toBeTruthy();
  });
});
