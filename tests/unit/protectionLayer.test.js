import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { paginationService } = require("../../backend/src/services/pagination/pagination.service");
const { SafeQueryBuilder } = require("../../backend/src/services/query/safe-query-builder");
const rateLimitConfig = require("../../backend/src/config/rate-limit.config");

describe("PaginationService", () => {
  it("aplica default pageSize 20", () => {
    const p = paginationService.parseFromQuery({}, { resource: "movements" });
    expect(p.page).toBe(1);
    expect(p.pageSize).toBe(20);
    expect(p.limit).toBe(20);
    expect(p.offset).toBe(0);
  });

  it("clampa pageSize acima de 100", () => {
    const p = paginationService.parseFromQuery(
      { pageSize: 5000 },
      { resource: "movements" }
    );
    expect(p.pageSize).toBe(100);
  });

  it("rejeita sort nao autorizado", () => {
    expect(() =>
      paginationService.parseFromQuery(
        { sort: "drop_table" },
        { resource: "movements" }
      )
    ).toThrow(/ordenacao/);
  });

  it("resolve ORDER BY whitelistado", () => {
    const p = paginationService.parseFromQuery(
      { sort: "valor", order: "asc" },
      { resource: "movements" }
    );
    const { clause } = paginationService.resolveOrderBy(p);
    expect(clause).toBe("m.valor ASC");
  });
});

describe("SafeQueryBuilder", () => {
  it("ignora filtros nao cadastrados", () => {
    const built = SafeQueryBuilder.for("movements").buildFromQuery(
      { evil: "1; DROP TABLE", status: "paga" },
      2
    );
    expect(built.sql).toContain("m.status");
    expect(built.sql).not.toContain("evil");
    expect(built.params).toEqual(["paga"]);
  });

  it("rejeita enum invalido", () => {
    expect(() =>
      SafeQueryBuilder.for("movements").buildFromQuery({ status: "hack" }, 2)
    ).toThrow();
  });
});

describe("rateLimit config", () => {
  it("define grupos obrigatorios", () => {
    expect(rateLimitConfig.groups.login.max).toBe(5);
    expect(rateLimitConfig.groups.privacyExport.max).toBe(2);
    expect(rateLimitConfig.groups.dashboard.max).toBe(100);
  });
});
