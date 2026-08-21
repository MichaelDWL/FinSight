import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("FASE 5 — Etapa 4/5 bootstrap audit", () => {
  it("crypto.js usa argon2 sob demanda (lazy)", () => {
    const src = fs.readFileSync(
      path.join(root, "backend/src/utils/crypto.js"),
      "utf8",
    );
    expect(src).toMatch(/function getArgon2/);
    expect(src).toMatch(/require\(["']argon2["']\)/);
  });

  it("csrf puxa utils/crypto (timingSafe; argon2 lazy)", () => {
    const src = fs.readFileSync(
      path.join(root, "backend/src/middlewares/csrf.middleware.js"),
      "utf8",
    );
    expect(src).toMatch(/utils\/crypto/);
  });

  it("market.scheduler nao e required por app.js", () => {
    const src = fs.readFileSync(path.join(root, "backend/src/app.js"), "utf8");
    expect(src).not.toMatch(/market\.scheduler/);
  });

  it("package.json nao inclui excel/chart pesados", () => {
    const pkg = require("../../package.json");
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps.xlsx).toBeUndefined();
    expect(deps.exceljs).toBeUndefined();
    expect(deps["chart.js"]).toBeUndefined();
    expect(deps.puppeteer).toBeUndefined();
  });
});
