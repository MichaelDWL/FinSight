import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("FASE 5 — Etapa 6 DB path instrumentation", () => {
  it("checkDatabaseConnection decompoe acquireMs e queryMs", () => {
    const src = fs.readFileSync(
      path.join(root, "backend/src/database/pool.js"),
      "utf8",
    );
    expect(src).toMatch(/acquireMs/);
    expect(src).toMatch(/queryMs/);
    expect(src).toMatch(/pool\.connect\(\)/);
  });

  it("/ready expoe acquireMs e queryMs", () => {
    const src = fs.readFileSync(
      path.join(root, "backend/src/modules/health/health.controller.js"),
      "utf8",
    );
    expect(src).toMatch(/acquireMs:\s*db\.acquireMs/);
    expect(src).toMatch(/queryMs:\s*db\.queryMs/);
  });

  it("pool max serverless permanece limitado (nao aumentado)", () => {
    const src = fs.readFileSync(
      path.join(root, "backend/src/database/pool.js"),
      "utf8",
    );
    expect(src).toMatch(/dbPoolMaxServerless \|\| 2/);
  });
});
