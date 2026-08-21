import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("FASE 2 — otimizacoes BFF / SQL", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requestContext.memoize deduplica promises no mesmo request", async () => {
    const {
      runWithRequestContext,
      memoize,
    } = require("../../backend/src/modules/bff/utils/requestContext");

    let calls = 0;
    const factory = async () => {
      calls += 1;
      return { ok: true, calls };
    };

    await runWithRequestContext(async () => {
      const [a, b, c] = await Promise.all([
        memoize("k", factory),
        memoize("k", factory),
        memoize("k", factory),
      ]);
      expect(calls).toBe(1);
      expect(a).toEqual(b);
      expect(b).toEqual(c);
    });

    await memoize("k", factory);
    expect(calls).toBe(2);
  });

  it("findById de contas nao usa constantes correlacionadas quebradas", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/accounts/accounts.repository");

    const querySpy = vi.spyOn(pool, "query").mockResolvedValueOnce({
      rows: [
        {
          id: "acc-1",
          nome: "Conta",
          tipo: "corrente",
          instituicao: null,
          saldo_atual: 100,
          cor: null,
          icone: null,
          observacao: null,
          status: "ativa",
          receitas_mes: 50,
          despesas_mes: 20,
          ultima_movimentacao: "2026-08-01",
          total_movimentacoes: 3,
        },
      ],
    }).mockResolvedValueOnce({ rows: [] });

    const account = await repository.findById(USER_A, "acc-1");
    const sql = querySpy.mock.calls[0][0];

    expect(sql).toMatch(/account_stats/i);
    expect(sql).toMatch(/UNION ALL/i);
    expect(sql).not.toMatch(/RECEITAS_MES|undefined/);
    expect(account.monthIncome).toBe(50);
    expect(account.monthExpenses).toBe(20);
    expect(account.movements).toEqual([]);
  });

  it("listAll com skipTotal nao executa COUNT", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/movements/movements.repository");

    const querySpy = vi.spyOn(pool, "query").mockResolvedValue({ rows: [] });

    await repository.listAll(USER_A, {
      skipTotal: true,
      pagination: { limit: 10, offset: 0, page: 1, pageSize: 10 },
    });

    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(querySpy.mock.calls[0][0]).not.toMatch(/COUNT\(\*\)/i);
  });

  it("asArray em listTransactions pula COUNT", async () => {
    const pool = require("../../backend/src/database/pool");
    const movementsService = require("../../backend/src/modules/movements/movements.service");

    const querySpy = vi.spyOn(pool, "query").mockResolvedValue({ rows: [] });
    await movementsService.listTransactions(USER_A, { pageSize: 6, asArray: true });

    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(querySpy.mock.calls[0][0]).not.toMatch(/COUNT\(\*\)/i);
  });

  it("insights BFF nao chama getDashboard", async () => {
    const insightsBff = require("../../backend/src/modules/bff/services/insights.bff.service");
    const dashboardService = require("../../backend/src/modules/dashboard/dashboard.service");
    const personalizationEngine = require("../../backend/src/modules/personalization/engine/PersonalizationEngine");
    const goalsService = require("../../backend/src/modules/goals/goals.service");
    const CacheService = require("../../backend/src/modules/bff/cache/cache.service");

    vi.spyOn(CacheService, "wrap").mockImplementation(async (_k, _ttl, fn) => ({
      data: await fn(),
      cacheHit: false,
    }));
    const dashSpy = vi.spyOn(dashboardService, "getDashboard");
    vi.spyOn(personalizationEngine, "readContext").mockResolvedValue({
      alerts: [],
      recommendations: [],
      budgets: [],
      progress: [],
      health: { score: 70 },
      insights: [{ text: "ok" }],
    });
    vi.spyOn(goalsService, "list").mockResolvedValue([{ id: "g1", name: "Meta" }]);

    const { data } = await insightsBff.getInsights(USER_A, {}, {
      reqUser: { id: USER_A, name: "A", email: "a@a.com", role: "user", status: "active" },
    });

    expect(dashSpy).not.toHaveBeenCalled();
    expect(data.goals).toHaveLength(1);
    expect(data.insights).toHaveLength(1);
    expect(data.financialHealth.score.score).toBe(70);
  });

  it("transactions BFF usa listSummary e nao list pesado", async () => {
    const transactionsBff = require("../../backend/src/modules/bff/services/transactions.bff.service");
    const accountsService = require("../../backend/src/modules/accounts/accounts.service");
    const movementsService = require("../../backend/src/modules/movements/movements.service");
    const dashboardRepository = require("../../backend/src/modules/dashboard/dashboard.repository");
    const CacheService = require("../../backend/src/modules/bff/cache/cache.service");

    vi.spyOn(CacheService, "wrap").mockImplementation(async (_k, _ttl, fn) => ({
      data: await fn(),
      cacheHit: false,
    }));
    const listSpy = vi.spyOn(accountsService, "list");
    const summarySpy = vi.spyOn(accountsService, "listSummary").mockResolvedValue([
      { id: "a1", name: "Conta" },
    ]);
    vi.spyOn(movementsService, "listTransactions").mockResolvedValue([]);
    vi.spyOn(dashboardRepository, "getCategorySpendingComparison").mockResolvedValue([]);
    vi.spyOn(dashboardRepository, "getMonthlyFlow").mockResolvedValue([]);
    vi.spyOn(dashboardRepository, "getFinancialSummary").mockResolvedValue({
      income: 0,
      expenses: 0,
    });

    await transactionsBff.getTransactions(USER_A, {}, {
      reqUser: { id: USER_A, name: "A", email: "a@a.com", role: "user", status: "active" },
    });

    expect(summarySpy).toHaveBeenCalled();
    expect(listSpy).not.toHaveBeenCalled();
  });

  it("compras do cartao usam LIMIT", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/cards/cards.repository");
    const invoiceService = require("../../backend/src/services/invoice.service");

    vi.spyOn(pool, "query")
      .mockResolvedValueOnce({
        rows: [
          {
            id: "c1",
            nome: "Nubank",
            banco: "Nu",
            bandeira: "Master",
            ultimos_digitos: "123",
            cor: "#111",
            dia_fechamento: 1,
            dia_vencimento: 10,
            limite_total: 1000,
            limite_disponivel: 800,
            observacao: null,
            fatura_atual: 0,
            proxima_fatura: 0,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    vi.spyOn(invoiceService, "listByCard").mockResolvedValue([]);

    await repository.findById(USER_A, "c1");
    const purchasesSql = pool.query.mock.calls[1][0];
    expect(purchasesSql).toMatch(/LIMIT \$3/i);
    expect(pool.query.mock.calls[1][1][2]).toBe(100);
  });

  it("ensureGeneratedOnce deduplica no mesmo requestContext", async () => {
    const recurrenceService = require("../../backend/src/services/recurrence.service");
    const { runWithRequestContext } = require("../../backend/src/modules/bff/utils/requestContext");

    recurrenceService.invalidateEnsureGenerated(USER_A);
    const syncSpy = vi
      .spyOn(recurrenceService, "syncRecurringTransactions")
      .mockResolvedValue(4);

    await runWithRequestContext(async () => {
      const [a, b] = await Promise.all([
        recurrenceService.ensureGeneratedOnce(USER_A),
        recurrenceService.ensureGeneratedOnce(USER_A),
      ]);
      expect(a).toBe(4);
      expect(b).toBe(4);
    });

    expect(syncSpy).toHaveBeenCalledTimes(1);
  });
});
