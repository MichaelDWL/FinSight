import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("FASE 2B — accounts.listSummary (Etapa 7)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("findSummary consulta apenas contas sem CTE de movimentacoes", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/accounts/accounts.repository");

    const querySpy = vi.spyOn(pool, "query").mockResolvedValue({
      rows: [
        {
          id: "a1",
          nome: "Nubank",
          tipo: "corrente",
          instituicao: "Nu",
          saldo_atual: "1500.50",
          cor: "#820ad1",
          icone: "bank",
          observacao: null,
          status: "ativa",
        },
        {
          id: "a2",
          nome: "Carteira",
          tipo: "dinheiro",
          instituicao: null,
          saldo_atual: "80",
          cor: null,
          icone: null,
          observacao: "",
          status: "ativa",
        },
      ],
    });

    const accounts = await repository.findSummary(USER_A);

    expect(querySpy).toHaveBeenCalledTimes(1);
    const [sql, params] = querySpy.mock.calls[0];
    expect(params).toEqual([USER_A]);
    expect(sql).toMatch(/FROM contas c/i);
    expect(sql).not.toMatch(/account_stats/i);
    expect(sql).not.toMatch(/movimentacoes/i);
    expect(sql).not.toMatch(/UNION ALL/i);
    expect(accounts).toEqual([
      {
        id: "a1",
        icon: "bank",
        name: "Nubank",
        type: "corrente",
        institution: "Nu",
        balance: 1500.5,
        color: "#820ad1",
        notes: "",
        status: "ativa",
        monthIncome: 0,
        monthExpenses: 0,
        lastMovement: null,
        movementsCount: 0,
      },
      {
        id: "a2",
        icon: "bank",
        name: "Carteira",
        type: "dinheiro",
        institution: "",
        balance: 80,
        color: "#0d6efd",
        notes: "",
        status: "ativa",
        monthIncome: 0,
        monthExpenses: 0,
        lastMovement: null,
        movementsCount: 0,
      },
    ]);
  });

  it("listSummary isola usuarios via parametro", async () => {
    const pool = require("../../backend/src/database/pool");
    const service = require("../../backend/src/modules/accounts/accounts.service");

    const querySpy = vi.spyOn(pool, "query").mockImplementation(async (_sql, params) => ({
      rows:
        params[0] === USER_A
          ? [{ id: "a1", nome: "A", tipo: "corrente", instituicao: null, saldo_atual: 1, cor: null, icone: null, observacao: null, status: "ativa" }]
          : [{ id: "b1", nome: "B", tipo: "corrente", instituicao: null, saldo_atual: 9, cor: null, icone: null, observacao: null, status: "ativa" }],
    }));

    const a = await service.listSummary(USER_A);
    const b = await service.listSummary(USER_B);

    expect(querySpy.mock.calls[0][1][0]).toBe(USER_A);
    expect(querySpy.mock.calls[1][1][0]).toBe(USER_B);
    expect(a[0].balance).toBe(1);
    expect(b[0].balance).toBe(9);
  });

  it("findAll continua com CTE de stats para tela de contas", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/accounts/accounts.repository");

    const querySpy = vi.spyOn(pool, "query").mockResolvedValue({ rows: [] });
    await repository.findAll(USER_A);

    const sql = querySpy.mock.calls[0][0];
    expect(sql).toMatch(/account_stats/i);
    expect(sql).toMatch(/movimentacoes/i);
  });

  it("mapAccountSummary preserva campos de shell e zera stats", () => {
    const { mapAccountSummary } = require("../../backend/src/modules/accounts/accounts.repository");
    const mapped = mapAccountSummary({
      id: "x",
      nome: "Itaú",
      tipo: "poupanca",
      instituicao: "Itau",
      saldo_atual: null,
      cor: null,
      icone: null,
      observacao: null,
      status: "ativa",
    });

    expect(mapped.balance).toBe(0);
    expect(mapped.monthIncome).toBe(0);
    expect(mapped.monthExpenses).toBe(0);
    expect(mapped.lastMovement).toBeNull();
    expect(mapped.movementsCount).toBe(0);
    expect(mapped.name).toBe("Itaú");
    expect(mapped.type).toBe("poupanca");
  });
});
