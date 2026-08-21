import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

describe("FASE 2B — Investimentos batch market (Etapa 9)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getAssets faz 3 queries em lote e nao N getAsset", async () => {
    const repository = require("../../backend/src/modules/market-data/market.repository");
    const marketService = require("../../backend/src/modules/market-data/market.service");

    const byCodes = vi.spyOn(repository, "getMarketDataByCodes").mockResolvedValue([
      {
        assetCode: "PETR4",
        currentPrice: 30,
        currency: "BRL",
        dailyChange: 1,
        monthlyChange: 2,
        yearlyChange: 3,
      },
      {
        assetCode: "VALE3",
        currentPrice: 60,
        currency: "BRL",
        dailyChange: 0,
        monthlyChange: 0,
        yearlyChange: 0,
      },
    ]);
    const historyBatch = vi.spyOn(repository, "getMarketHistoryBatch").mockResolvedValue(
      new Map([
        ["PETR4", [{ price: 29, date: "2026-01-01" }, { price: 30, date: "2026-01-02" }]],
        ["VALE3", [{ price: 60, date: "2026-01-01" }]],
      ]),
    );
    const statsBatch = vi.spyOn(repository, "getMarketStatsBatch").mockResolvedValue(
      new Map([
        ["PETR4", { minPrice: 29, maxPrice: 30, avgPrice: 29.5, points: 2 }],
        ["VALE3", { minPrice: 60, maxPrice: 60, avgPrice: 60, points: 1 }],
      ]),
    );
    const single = vi.spyOn(repository, "getMarketDataByCode");

    const map = await marketService.getAssets(["petr4", "VALE3", "PETR4"], { historyLimit: 90 });

    expect(byCodes).toHaveBeenCalledTimes(1);
    expect(historyBatch).toHaveBeenCalledWith(["PETR4", "VALE3"], { limit: 90 });
    expect(statsBatch).toHaveBeenCalledWith(["PETR4", "VALE3"]);
    expect(single).not.toHaveBeenCalled();
    expect(map.get("PETR4").currentPrice).toBe(30);
    expect(map.get("PETR4").history).toHaveLength(2);
    expect(map.get("PETR4").stats.volatility).toBeTypeOf("number");
    expect(map.get("VALE3").currentPrice).toBe(60);
  });

  it("getAssets retorna null para codigo sem snapshot", async () => {
    const repository = require("../../backend/src/modules/market-data/market.repository");
    const marketService = require("../../backend/src/modules/market-data/market.service");

    vi.spyOn(repository, "getMarketDataByCodes").mockResolvedValue([]);
    vi.spyOn(repository, "getMarketHistoryBatch").mockResolvedValue(new Map());
    vi.spyOn(repository, "getMarketStatsBatch").mockResolvedValue(new Map());

    const map = await marketService.getAssets(["XYZ9"]);
    expect(map.get("XYZ9")).toBeNull();
  });

  it("listDetailed usa getAssets em vez de getAsset por codigo", async () => {
    const investmentsService = require("../../backend/src/modules/investments/investments.service");
    const investmentsRepository = require("../../backend/src/modules/investments/investments.repository");
    const marketService = require("../../backend/src/modules/market-data/market.service");
    const rateService = require("../../backend/src/modules/market-data/rate.service");

    vi.spyOn(investmentsRepository, "findAll").mockResolvedValue({
      items: [
        {
          id: "1",
          name: "Petro",
          type: "Acoes",
          assetCode: "PETR4",
          investmentType: "acoes",
          invested: 100,
          value: 120,
        },
        {
          id: "2",
          name: "CDB",
          type: "Renda Fixa",
          assetCode: null,
          investmentType: "cdb",
          invested: 200,
          value: 210,
        },
      ],
      page: 1,
      pageSize: 100,
      total: 2,
    });
    vi.spyOn(rateService, "getCurrentRates").mockResolvedValue({
      selic: 10,
      cdi: 10,
      ipca: 4,
    });
    const getAssets = vi.spyOn(marketService, "getAssets").mockResolvedValue(
      new Map([
        [
          "PETR4",
          {
            assetCode: "PETR4",
            currentPrice: 30,
            history: [{ price: 30, date: "2026-01-01" }],
            stats: { minPrice: 30, maxPrice: 30, avgPrice: 30, points: 1, volatility: 0 },
          },
        ],
      ]),
    );
    const getAsset = vi.spyOn(marketService, "getAsset");

    const detailed = await investmentsService.listDetailed("user-a");

    expect(getAssets).toHaveBeenCalledWith(["PETR4"], { historyLimit: 90 });
    expect(getAsset).not.toHaveBeenCalled();
    expect(detailed).toHaveLength(2);
    expect(detailed[0].simulation?.kind).toBe("variable_income");
    expect(detailed[0].simulation?.market?.history).toHaveLength(1);
    expect(detailed[1].simulation?.kind).toBe("fixed_income");
  });

  it("listDetailed com zero investimentos nao consulta market", async () => {
    const investmentsService = require("../../backend/src/modules/investments/investments.service");
    const investmentsRepository = require("../../backend/src/modules/investments/investments.repository");
    const marketService = require("../../backend/src/modules/market-data/market.service");
    const rateService = require("../../backend/src/modules/market-data/rate.service");

    vi.spyOn(investmentsRepository, "findAll").mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
    });
    vi.spyOn(rateService, "getCurrentRates").mockResolvedValue({});
    const getAssets = vi.spyOn(marketService, "getAssets").mockResolvedValue(new Map());

    const detailed = await investmentsService.listDetailed("user-a");
    expect(detailed).toEqual([]);
    expect(getAssets).toHaveBeenCalledWith([], { historyLimit: 90 });
  });

  it("getMarketHistoryBatch SQL usa ANY e ROW_NUMBER", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/market-data/market.repository");

    const querySpy = vi.spyOn(pool, "query").mockResolvedValue({
      rows: [
        { asset_code: "PETR4", price: 10, date: "2026-01-01", provider: null, source: null, createdAt: null },
      ],
    });

    const map = await repository.getMarketHistoryBatch(["petr4"], { limit: 90 });
    const [sql, params] = querySpy.mock.calls[0];
    expect(params[0]).toEqual(["PETR4"]);
    expect(params[1]).toBe(90);
    expect(sql).toMatch(/ANY\(\$1::text\[\]\)/);
    expect(sql).toMatch(/ROW_NUMBER/);
    expect(map.get("PETR4")).toHaveLength(1);
  });

  it("isolamento: getMarketDataByCodes passa array de codes parametrizado", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/market-data/market.repository");

    const querySpy = vi.spyOn(pool, "query").mockResolvedValue({ rows: [] });
    await repository.getMarketDataByCodes(["AAA", "BBB"]);
    expect(querySpy.mock.calls[0][1][0]).toEqual(["AAA", "BBB"]);
    expect(querySpy.mock.calls[0][0]).toMatch(/ANY\(\$1::text\[\]\)/);
  });
});
