import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

describe("FASE 5 — Etapa 9 CacheService inflight", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("coalesce concurrent wrap MISS na mesma key", async () => {
    const CacheService = require("../../backend/src/modules/bff/cache/cache.service");
    await CacheService.init();
    await CacheService.invalidatePrefix("bff:");

    let calls = 0;
    const key = CacheService.buildKey("stress-test", "user-a");
    const factory = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 30));
      return { ok: true, calls };
    };

    const [a, b, c] = await Promise.all([
      CacheService.wrap(key, 60, factory),
      CacheService.wrap(key, 60, factory),
      CacheService.wrap(key, 60, factory),
    ]);

    expect(calls).toBe(1);
    expect(a.data.ok).toBe(true);
    expect(b.data.ok).toBe(true);
    expect(c.data.ok).toBe(true);
    const hits = [a, b, c].filter((x) => x.cacheHit).length;
    expect(hits).toBe(2);
  });
});
