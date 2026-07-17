import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { hasAnyRole, ROLES } = require("../../src/modules/auth/constants");

describe("admin RBAC", () => {
  it("ADMIN e SUPER_ADMIN passam requireAdmin", () => {
    expect(hasAnyRole(ROLES.ADMIN, [ROLES.ADMIN, ROLES.SUPER_ADMIN])).toBe(true);
    expect(hasAnyRole(ROLES.SUPER_ADMIN, [ROLES.ADMIN, ROLES.SUPER_ADMIN])).toBe(true);
  });

  it("USER nao passa", () => {
    expect(hasAnyRole(ROLES.USER, [ROLES.ADMIN, ROLES.SUPER_ADMIN])).toBe(false);
  });
});
