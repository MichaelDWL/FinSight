import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";

describe("JWT helpers (smoke)", () => {
  const secret = "test-access-secret-min-32-chars-xxxx";

  it("assina e verifica access token", () => {
    const token = jwt.sign(
      { sub: "user-1", sid: "sess-1", role: "USER" },
      secret,
      { expiresIn: "15m", issuer: "finsight", audience: "finsight-api" }
    );
    const payload = jwt.verify(token, secret, {
      issuer: "finsight",
      audience: "finsight-api",
    });
    expect(payload.sub).toBe("user-1");
    expect(payload.sid).toBe("sess-1");
  });

  it("rejeita assinatura invalida", () => {
    const token = jwt.sign({ sub: "x" }, secret);
    expect(() => jwt.verify(token, "wrong-secret-min-32-chars-zzzzzz")).toThrow();
  });
});
