import { describe, it, expect, beforeAll } from "vitest";
import { createRequire } from "module";
import http from "http";

const require = createRequire(import.meta.url);

describe("API smoke", () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = process.env.NODE_ENV || "test";
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET || "test-access-secret-min-32-chars-xxxx";
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || "test-refresh-secret-min-32-chars-xxxx";
    process.env.CRON_SECRET = process.env.CRON_SECRET || "test-cron-secret-16";
    process.env.REQUIRE_EMAIL_VERIFIED = "false";

    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL =
        "postgres://finsight:finsight_dev_password@127.0.0.1:15432/finsight";
    }

    app = require("../../backend/src/app");
  });

  it("GET /live responde 200", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    const body = await new Promise((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${port}/live`, (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => resolve({ status: res.statusCode, data }));
        })
        .on("error", reject);
    });

    await new Promise((resolve) => server.close(resolve));
    expect(body.status).toBe(200);
    expect(body.data).toContain("Alive");
  });
});
