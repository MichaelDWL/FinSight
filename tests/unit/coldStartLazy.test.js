import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("FASE 5 — Etapa 5 cold start reductions", () => {
  it("crypto.js nao carrega argon2 no module scope", () => {
    const src = fs.readFileSync(path.join(root, "backend/src/utils/crypto.js"), "utf8");
    expect(src).not.toMatch(/^const argon2 = require\(["']argon2["']\)/m);
    expect(src).toMatch(/require\(["']argon2["']\)/);
  });

  it("requestMeta nao carrega ua-parser no module scope", () => {
    const src = fs.readFileSync(path.join(root, "backend/src/utils/requestMeta.js"), "utf8");
    expect(src).not.toMatch(/^const \{ UAParser \} = require/m);
    expect(src).toMatch(/ua-parser-js/);
  });

  it("routes/index usa mountLazy para CRUD/market", () => {
    const src = fs.readFileSync(path.join(root, "backend/src/routes/index.js"), "utf8");
    expect(src).toMatch(/function mountLazy/);
    expect(src).toMatch(/mountLazy\(router, "\/market"/);
    expect(src).toMatch(/mountLazy\(router, "\/admin"/);
    expect(src).toMatch(/require\(["'].*bff\.routes["']\)/);
  });

  it("bff.controller lazy-load de services", () => {
    const src = fs.readFileSync(
      path.join(root, "backend/src/modules/bff/bff.controller.js"),
      "utf8",
    );
    expect(src).toMatch(/function lazyFn/);
    expect(src).not.toMatch(/^const homeBffService = require/m);
  });

  it("hashPassword ainda funciona com argon2 lazy", async () => {
    const { hashPassword, verifyPassword, timingSafeEqualString } = require(
      "../../backend/src/utils/crypto",
    );
    expect(timingSafeEqualString("abc", "abc")).toBe(true);
    const hash = await hashPassword("test-password-etapa5");
    expect(hash).toMatch(/^\$argon2/);
    expect(await verifyPassword(hash, "test-password-etapa5")).toBe(true);
  });
});
