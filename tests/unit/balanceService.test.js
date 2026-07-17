import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { accountDeltas, isSettled } = require("../../src/services/balanceService");

describe("balanceService", () => {
  it("nao aplica delta se status nao liquidado", () => {
    expect(
      accountDeltas({
        status: "pendente",
        tipo: "despesa",
        valor: 100,
        conta_id: "a1",
      })
    ).toEqual([]);
  });

  it("credita receita liquidada", () => {
    expect(
      accountDeltas({
        status: "confirmada",
        tipo: "receita",
        valor: 50,
        conta_id: "a1",
      })
    ).toEqual([{ accountId: "a1", delta: 50 }]);
  });

  it("transfere entre contas", () => {
    expect(
      accountDeltas({
        status: "confirmada",
        tipo: "transferencia",
        valor: 20,
        conta_id: "origem",
        conta_destino_id: "destino",
      })
    ).toEqual([
      { accountId: "origem", delta: -20 },
      { accountId: "destino", delta: 20 },
    ]);
  });

  it("isSettled reconhece paga e confirmada", () => {
    expect(isSettled("paga")).toBe(true);
    expect(isSettled("confirmada")).toBe(true);
    expect(isSettled("pendente")).toBe(false);
  });
});
