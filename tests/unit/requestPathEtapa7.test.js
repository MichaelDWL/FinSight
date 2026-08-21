import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("FASE 5 — Etapa 7 request path", () => {
  it("morgan nao e eager no app.js serverless", () => {
    const src = fs.readFileSync(path.join(root, "backend/src/app.js"), "utf8");
    expect(src).toMatch(/if \(!isServerless\)/);
    expect(src).not.toMatch(/^const morgan = require/m);
  });

  it("bff.monitor nao faz JSON.stringify so para bytes", () => {
    const src = fs.readFileSync(
      path.join(root, "backend/src/modules/bff/monitoring/bff.monitor.js"),
      "utf8",
    );
    expect(src).not.toMatch(/Buffer\.byteLength\(JSON\.stringify/);
  });

  it("bff.routes nao require accounts.validator no topo", () => {
    const src = fs.readFileSync(
      path.join(root, "backend/src/modules/bff/bff.routes.js"),
      "utf8",
    );
    expect(src).not.toMatch(/^const \{ idParam \} = require/m);
    expect(src).toMatch(/function validateAccountIdParam/);
  });
});
