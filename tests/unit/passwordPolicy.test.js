import { describe, it, expect } from "vitest";
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(10)
  .max(128)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);

describe("password policy", () => {
  it("rejeita senha curta", () => {
    expect(passwordSchema.safeParse("Ab1!xxxx").success).toBe(false);
  });

  it("rejeita sem maiuscula", () => {
    expect(passwordSchema.safeParse("abcdefghi1!").success).toBe(false);
  });

  it("aceita senha forte", () => {
    expect(passwordSchema.safeParse("SenhaForte1!").success).toBe(true);
  });
});
