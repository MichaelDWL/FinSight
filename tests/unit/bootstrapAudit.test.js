import { describe, expect, it } from "vitest";
import { createRequire } from "module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("FASE 5 — Etapa 4 bootstrap audit (sem otimizar)", () => {
  it("crypto.js ainda carrega argon2 no module scope (candidato lazy Etapa 5)", () => {
    const src = fs.readFileSync(
      path.join(root, "backend/src/utils/crypto.js"),
      "utf8",
    );
    expect(src).toMatch(/require\(["']argon2["']\)/);
  });

  it("csrf puxa utils/crypto (caminho cold → argon2)", () => {
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
