import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "module";
import http from "http";

const require = createRequire(import.meta.url);

describe("runtime memory-only", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET || "test-access-secret-min-32-chars-xxxx";
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || "test-refresh-secret-min-32-chars-xxxx";
    process.env.CRON_SECRET = process.env.CRON_SECRET || "test-cron-secret-16";
    process.env.REQUIRE_EMAIL_VERIFIED = "false";
    delete process.env.REDIS_URL;

    const CacheService = require("../../backend/src/modules/bff/cache/cache.service");
    const { cacheAdapter } = require("../../backend/src/modules/analytics/analytics.cache");
    await CacheService.invalidatePrefix("bff:");
    await cacheAdapter.invalidateUser("user-a");
    await cacheAdapter.invalidateUser("user-b");
  });

  it("mantem o stub Redis desabilitado", async () => {
    const sharedRedis = require("../../backend/src/platform/redis");
    expect(sharedRedis.isReady()).toBe(false);
    expect(sharedRedis.getClient()).toBe(null);
    await expect(sharedRedis.connect()).resolves.toBe(null);
  });

  it("opera o CacheService em memoria com isolamento por usuario", async () => {
    const CacheService = require("../../backend/src/modules/bff/cache/cache.service");

    await CacheService.init();
    const keyA = CacheService.buildKey("accounts", "user-a");
    const keyB = CacheService.buildKey("accounts", "user-b");

    await CacheService.set(keyA, { owner: "user-a" }, 30);
    await CacheService.set(keyB, { owner: "user-b" }, 30);

    await expect(CacheService.get(keyA)).resolves.toEqual({ owner: "user-a" });
    await expect(CacheService.get(keyB)).resolves.toEqual({ owner: "user-b" });

    await CacheService.invalidateUser("user-a");

    await expect(CacheService.get(keyA)).resolves.toBe(null);
    await expect(CacheService.get(keyB)).resolves.toEqual({ owner: "user-b" });
    expect(CacheService.getStatus().mode).toBe("memory");
    expect(CacheService.getStatus().redisConnected).toBe(false);
  });

  it("mantem analytics cache em memoria e invalida por usuario", async () => {
    const {
      cacheAdapter,
      buildCacheKey,
      initCache,
    } = require("../../backend/src/modules/analytics/analytics.cache");

    await initCache();
    const keyA = buildCacheKey("user-a", "general", {
      period: "30d",
      startDate: "2026-01-01",
      endDate: "2026-01-30",
    });
    const keyB = buildCacheKey("user-b", "general", {
      period: "30d",
      startDate: "2026-01-01",
      endDate: "2026-01-30",
    });

    await cacheAdapter.set(keyA, { total: 10 }, 30);
    await cacheAdapter.set(keyB, { total: 20 }, 30);

    await cacheAdapter.invalidateUser("user-a");

    await expect(cacheAdapter.get(keyA)).resolves.toBe(null);
    await expect(cacheAdapter.get(keyB)).resolves.toEqual({ total: 20 });
    expect(cacheAdapter.getStatus().mode).toBe("memory");
    expect(cacheAdapter.getStatus().redisConnected).toBe(false);
  });

  it("responde /ready sem Redis e com cache em memoria", async () => {
    const app = require("../../backend/src/app");
    const pool = require("../../backend/src/database/pool");
    const originalCheck = pool.checkDatabaseConnection;

    pool.checkDatabaseConnection = async () => ({
      status: "ok",
      responseTimeMs: 12,
      postgresVersion: "17.6",
      database: "postgres",
      ssl: { enabled: true, rejectUnauthorized: true, caProvided: false },
    });

    const server = app.listen(0);
    const { port } = server.address();

    try {
      const body = await new Promise((resolve, reject) => {
        http
          .get(`http://127.0.0.1:${port}/ready`, (res) => {
            let data = "";
            res.on("data", (chunk) => {
              data += chunk;
            });
            res.on("end", () =>
              resolve({ status: res.statusCode, data: JSON.parse(data) })
            );
          })
          .on("error", reject);
      });

      expect(body.status).toBe(200);
      expect(body.data.data.redis).toBe("not-configured");
      expect(body.data.data.cache.analytics.mode).toBe("memory");
      expect(body.data.data.cache.bff.mode).toBe("memory");
      expect(body.data.data.rateLimit.mode).toBe("memory");
    } finally {
      pool.checkDatabaseConnection = originalCheck;
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
