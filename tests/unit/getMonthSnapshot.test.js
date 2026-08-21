import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("FASE 2B — getMonthSnapshot consolidado", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("monthBounds calcula inicio do mes e exclusao do mes seguinte", () => {
    const { monthBounds } = require("../../backend/src/modules/personalization/personalization.repository");

    expect(monthBounds("2026-08-15")).toEqual({
      monthStart: "2026-08-01",
      nextMonth: "2026-09-01",
    });
    expect(monthBounds("2026-12-01")).toEqual({
      monthStart: "2026-12-01",
      nextMonth: "2027-01-01",
    });
    expect(monthBounds("2026-01-01")).toEqual({
      monthStart: "2026-01-01",
      nextMonth: "2026-02-01",
    });
  });

  it("mapMonthSnapshotRow trata NULL/vazio e preserva formato", () => {
    const { mapMonthSnapshotRow } = require("../../backend/src/modules/personalization/personalization.repository");

    const empty = mapMonthSnapshotRow({});
    expect(empty).toEqual({
      income: 0,
      expenses: 0,
      investedExpenses: 0,
      goals: [],
      pendingBills: [],
      cards: [],
      portfolio: 0,
      investedCapital: 0,
    });

    const mapped = mapMonthSnapshotRow({
      income: null,
      expenses: "350.5",
      goals: [
        {
          id: "g1",
          nome: "Viagem",
          valor_alvo: 1000,
          valor_atual: 250,
          prazo: "2026-12-01",
          status: "ativa",
        },
      ],
      pending_bills: [
        {
          id: "b1",
          descricao: "Luz",
          valor: "120",
          data_transacao: "2026-08-01",
          status: "pendente",
        },
      ],
      cards: [
        {
          id: "c1",
          nome: "Visa",
          dia_fechamento: 5,
          dia_vencimento: null,
          limite_total: 1000,
          limite_disponivel: 400,
        },
      ],
      portfolio: null,
      invested: "800",
    });

    expect(mapped.income).toBe(0);
    expect(mapped.expenses).toBe(350.5);
    expect(mapped.goals[0]).toMatchObject({
      id: "g1",
      name: "Viagem",
      target: 1000,
      current: 250,
      remaining: 750,
      progress: 25,
    });
    expect(mapped.pendingBills[0]).toMatchObject({
      id: "b1",
      description: "Luz",
      value: 120,
      dueDate: "2026-08-01",
      status: "pendente",
    });
    expect(mapped.cards[0]).toMatchObject({
      name: "Visa",
      dueDay: 10,
      totalLimit: 1000,
      availableLimit: 400,
      usedLimit: 600,
    });
    expect(mapped.portfolio).toBe(0);
    expect(mapped.investedCapital).toBe(800);
  });

  it("getMonthSnapshot faz 1 query com filtro por intervalo e userId", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/personalization/personalization.repository");

    const querySpy = vi.spyOn(pool, "query").mockResolvedValue({
      rows: [
        {
          income: 5000,
          expenses: 2000,
          goals: [],
          pending_bills: [],
          cards: [],
          portfolio: 1000,
          invested: 900,
        },
      ],
    });

    const snapshot = await repository.getMonthSnapshot(USER_A, "2026-08-01");

    expect(querySpy).toHaveBeenCalledTimes(1);
    const [sql, params] = querySpy.mock.calls[0];
    expect(params).toEqual([USER_A, "2026-08-01", "2026-09-01"]);
    expect(sql).toMatch(/data_transacao\s*>=\s*b\.month_start/i);
    expect(sql).toMatch(/data_transacao\s*<\s*b\.next_month/i);
    expect(sql).not.toMatch(/date_trunc\s*\(\s*'month'\s*,\s*m?\.?data_transacao/i);
    expect(sql).toContain("$1");
    expect(snapshot).toEqual({
      income: 5000,
      expenses: 2000,
      investedExpenses: 0,
      goals: [],
      pendingBills: [],
      cards: [],
      portfolio: 1000,
      investedCapital: 900,
    });
  });

  it("getMonthSnapshot retorna zeros para usuario sem dados", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/personalization/personalization.repository");

    vi.spyOn(pool, "query").mockResolvedValue({
      rows: [
        {
          income: 0,
          expenses: 0,
          goals: [],
          pending_bills: [],
          cards: [],
          portfolio: 0,
          invested: 0,
        },
      ],
    });

    const snapshot = await repository.getMonthSnapshot(USER_A, "2026-08-01");
    expect(snapshot.income).toBe(0);
    expect(snapshot.expenses).toBe(0);
    expect(snapshot.goals).toEqual([]);
    expect(snapshot.pendingBills).toEqual([]);
    expect(snapshot.cards).toEqual([]);
    expect(snapshot.portfolio).toBe(0);
  });

  it("getMonthSnapshot isola usuarios via parametro $1", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/personalization/personalization.repository");

    const querySpy = vi.spyOn(pool, "query").mockImplementation(async (_sql, params) => ({
      rows: [
        {
          income: params[0] === USER_A ? 100 : 999,
          expenses: 0,
          goals: [],
          pending_bills: [],
          cards: [],
          portfolio: 0,
          invested: 0,
        },
      ],
    }));

    const snapA = await repository.getMonthSnapshot(USER_A, "2026-08-01");
    const snapB = await repository.getMonthSnapshot(USER_B, "2026-08-01");

    expect(querySpy.mock.calls[0][1][0]).toBe(USER_A);
    expect(querySpy.mock.calls[1][1][0]).toBe(USER_B);
    expect(snapA.income).toBe(100);
    expect(snapB.income).toBe(999);
  });

  it("limites do mes: params incluem primeiro dia e excluem mes seguinte", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/personalization/personalization.repository");

    const querySpy = vi.spyOn(pool, "query").mockResolvedValue({
      rows: [{ income: 0, expenses: 0, goals: [], pending_bills: [], cards: [], portfolio: 0, invested: 0 }],
    });

    await repository.getMonthSnapshot(USER_A, "2026-08-31");
    expect(querySpy.mock.calls[0][1]).toEqual([USER_A, "2026-08-01", "2026-09-01"]);
  });

  it("readContext continua read-only e consome getMonthSnapshot", async () => {
    const repository = require("../../backend/src/modules/personalization/personalization.repository");
    const engine = require("../../backend/src/modules/personalization/engine/PersonalizationEngine");
    const cache = require("../../backend/src/modules/personalization/cache/personalization.cache");

    vi.spyOn(cache, "get").mockResolvedValue(null);
    vi.spyOn(cache, "set").mockResolvedValue(undefined);

    vi.spyOn(repository, "findProfile").mockResolvedValue({
      id: "p1",
      userId: USER_A,
      profileType: "equilibrado",
      incomeSource: null,
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
      expenses: 2000,
      investedExpenses: 0,
      goals: [],
      pendingBills: [],
      cards: [],
      portfolio: 100,
      investedCapital: 80,
    });
    vi.spyOn(repository, "getSpendingByCategory").mockResolvedValue([]);
    vi.spyOn(repository, "listBudgetRules").mockResolvedValue([]);
    vi.spyOn(repository, "listHealthHistory").mockResolvedValue([]);

    const upsertProfile = vi.spyOn(repository, "upsertProfile");
    const replaceBudgetRules = vi.spyOn(repository, "replaceBudgetRules");
    const updateBudgetUsage = vi.spyOn(repository, "updateBudgetUsage");
    const upsertHealthScore = vi.spyOn(repository, "upsertHealthScore");

    const context = await engine.readContext(USER_A, { force: true });

    expect(repository.getMonthSnapshot).toHaveBeenCalledWith(USER_A, expect.any(String));
    expect(context.profile.monthlyIncome).toBe(5000);
    expect(upsertProfile).not.toHaveBeenCalled();
    expect(replaceBudgetRules).not.toHaveBeenCalled();
    expect(updateBudgetUsage).not.toHaveBeenCalled();
    expect(upsertHealthScore).not.toHaveBeenCalled();
  });

  it("snapshot com receitas e despesas preserva ambos os totais", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/personalization/personalization.repository");

    vi.spyOn(pool, "query").mockResolvedValue({
      rows: [
        {
          income: 4500,
          expenses: 3200,
          goals: [],
          pending_bills: [],
          cards: [],
          portfolio: 0,
          invested: 0,
        },
      ],
    });

    const snapshot = await repository.getMonthSnapshot(USER_A, "2026-08-01");
    expect(snapshot.income).toBe(4500);
    expect(snapshot.expenses).toBe(3200);
  });
});
