import { describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

describe("BFF monitor + SQL tracker", () => {
  it("runWithSqlTracking isola contadores por invocacao", async () => {
    const { runWithSqlTracking, recordQuery, getSqlStats } = require(
      "../../backend/src/modules/bff/monitoring/sql.tracker",
    );

    expect(getSqlStats()).toBeNull();

    await runWithSqlTracking(async () => {
      recordQuery({ durationMs: 10, rowCount: 2 });
      recordQuery({ durationMs: 5, rowCount: 1 });
      expect(getSqlStats()).toEqual({
        queryCount: 2,
        totalQueryMs: 15,
        rowCount: 3,
      });
    });

    expect(getSqlStats()).toBeNull();
  });

  it("createBffMonitor expoe headers de performance", () => {
    const { runWithSqlTracking, recordQuery } = require(
      "../../backend/src/modules/bff/monitoring/sql.tracker",
    );
    const { createBffMonitor } = require(
      "../../backend/src/modules/bff/monitoring/bff.monitor",
    );

    const headers = {};
    const res = {
      headersSent: false,
      statusCode: 200,
      setHeader(name, value) {
        headers[name] = value;
      },
    };

    const metrics = runWithSqlTracking(() => {
      recordQuery({ durationMs: 12.5, rowCount: 4 });
      const monitor = createBffMonitor("home", { userId: "u1" });
      monitor.setCacheHit(false);
      monitor.setRecordCount(3);
      monitor.captureSql();
      const payload = monitor.measureSerialize(() => ({ ok: true }));
      return monitor.finish(res, payload);
    });

    expect(metrics.sqlQueryCount).toBe(1);
    expect(metrics.cacheHit).toBe(false);
    expect(headers["X-BFF-Endpoint"]).toBe("home");
    expect(headers["X-BFF-Cache"]).toBe("MISS");
    expect(Number(headers["X-BFF-Duration-Ms"])).toBeGreaterThanOrEqual(0);
    expect(headers["X-BFF-SQL-Count"]).toBe("1");
    expect(headers["X-BFF-SQL-Ms"]).toBe("12.5");
    expect(headers["X-BFF-Warm"]).toMatch(/^[01]$/);
  });

  it("captureSql preserva contagem apos sair do ALS", () => {
    const { runWithSqlTracking, recordQuery, getSqlStats } = require(
      "../../backend/src/modules/bff/monitoring/sql.tracker",
    );
    const { createBffMonitor } = require(
      "../../backend/src/modules/bff/monitoring/bff.monitor",
    );

    const headers = {};
    const res = {
      headersSent: false,
      statusCode: 200,
      setHeader(name, value) {
        headers[name] = value;
      },
    };

    const monitor = createBffMonitor("accounts", { userId: "u2" });
    runWithSqlTracking(() => {
      recordQuery({ durationMs: 3, rowCount: 1 });
      recordQuery({ durationMs: 4, rowCount: 2 });
      monitor.captureSql();
    });

    expect(getSqlStats()).toBeNull();
    const metrics = monitor.finish(res, { items: [] });
    expect(metrics.sqlQueryCount).toBe(2);
    expect(headers["X-BFF-SQL-Count"]).toBe("2");
  });

  it("countRecords soma arrays aninhados", () => {
    const { countRecords } = require(
      "../../backend/src/modules/bff/monitoring/bff.monitor",
    );
    expect(countRecords({ a: [1, 2], b: { c: [3] } })).toBe(3);
  });
});
