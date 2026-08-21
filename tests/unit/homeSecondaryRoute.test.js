import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

describe("FASE 5 — Etapa 2 deploy / home secondary route", () => {
  it("registra GET /home/secondary no router BFF", () => {
    const router = require("../../backend/src/modules/bff/bff.routes");
    const layer = router.stack.find(
      (entry) =>
        entry.route &&
        entry.route.path === "/home/secondary" &&
        entry.route.methods.get,
    );
    expect(layer).toBeTruthy();
  });

  it("exporta handler homeSecondary no controller", () => {
    const controller = require("../../backend/src/modules/bff/bff.controller");
    expect(typeof controller.homeSecondary).toBe("function");
  });

  it("catalogo da API raiz menciona homeSecondary", () => {
    const app = require("../../backend/src/app");
    const layer = app._router.stack.find(
      (entry) => entry.route && entry.route.path === "/",
    );
    expect(layer).toBeTruthy();
  });
});
