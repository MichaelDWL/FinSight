/**
 * FASE 5 — Etapa 9: stress / concorrencia controlada em producao.
 *
 * Uso:
 *   node --env-file=backend/.env.vercel scripts/measure-stress.mjs
 *   node --env-file=backend/.env.vercel scripts/measure-stress.mjs --concurrency 8
 *
 * Nao imprime PII/tokens. Nao aumenta pool.
 */
import http from "node:http";
import https from "node:https";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const baseUrl =
  (baseIdx >= 0 ? args[baseIdx + 1] : null) ||
  process.env.APP_PUBLIC_URL ||
  "https://finsight-mdwl.vercel.app";
const concurrency = Number(
  args.includes("--concurrency") ? args[args.indexOf("--concurrency") + 1] : 6,
) || 6;

const ENDPOINTS = [
  "/api/home",
  "/api/home/secondary",
  "/api/dashboard?period=30d",
  "/api/accounts",
  "/api/investments",
];

function request(pathname, cookie) {
  const url = new URL(pathname, baseUrl);
  const lib = url.protocol === "https:" ? https : http;
  const wallStart = process.hrtime.bigint();
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { Cookie: cookie, Accept: "application/json" },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const wallMs = Number(process.hrtime.bigint() - wallStart) / 1e6;
          resolve({
            status: res.statusCode,
            wallMs: Math.round(wallMs * 100) / 100,
            serverMs: Number(res.headers["x-bff-duration-ms"]) || null,
            sqlCount: Number(res.headers["x-bff-sql-count"]),
            sqlMs: Number(res.headers["x-bff-sql-ms"]),
            cache: res.headers["x-bff-cache"] || null,
            warm: res.headers["x-bff-warm"] || null,
            bodyLen: Buffer.concat(chunks).length,
          });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(120_000, () => req.destroy(new Error(`timeout ${pathname}`)));
    req.end();
  });
}

async function pickCookie() {
  const pool = require("../backend/src/database/pool");
  const { signAccessToken } = require("../backend/src/utils/jwt");
  const { ACCOUNT_STATUS } = require("../backend/src/modules/auth/constants");
  const { rows } = await pool.query(
    `SELECT id, email, papel AS role, status, nome
     FROM usuarios WHERE status = $1
     ORDER BY created_at ASC NULLS LAST LIMIT 2`,
    [ACCOUNT_STATUS.ACTIVE],
  );
  if (!rows.length) throw new Error("Nenhum usuario ativo");
  return rows.map((user) => ({
    userIdPrefix: String(user.id).slice(0, 8),
    cookie: `finsight_access=${signAccessToken({
      sub: user.id,
      email: user.email,
      name: user.nome || null,
      role: user.role || "USER",
      status: user.status,
      emailVerified: true,
    })}`,
  }));
}

function summarize(samples) {
  const ok = samples.filter((s) => s.status === 200);
  const err = samples.filter((s) => s.status !== 200);
  const walls = ok.map((s) => s.wallMs).sort((a, b) => a - b);
  const p = (arr, pct) =>
    arr.length
      ? arr[Math.min(arr.length - 1, Math.ceil((pct / 100) * arr.length) - 1)]
      : null;
  return {
    n: samples.length,
    ok: ok.length,
    errors: err.length,
    statuses: [...new Set(samples.map((s) => s.status))],
    wallP50: p(walls, 50),
    wallP95: p(walls, 95),
    wallMax: walls.length ? walls[walls.length - 1] : null,
    caches: [...new Set(ok.map((s) => s.cache))],
    sqlCountMax: Math.max(0, ...ok.map((s) => (Number.isFinite(s.sqlCount) ? s.sqlCount : 0))),
    errorSamples: err.slice(0, 5).map((s) => ({ status: s.status, wallMs: s.wallMs })),
  };
}

async function burst(label, pathname, cookies, n) {
  const jobs = [];
  for (let i = 0; i < n; i += 1) {
    const c = cookies[i % cookies.length];
    jobs.push(request(pathname, c.cookie));
  }
  const started = Date.now();
  const samples = await Promise.all(
    jobs.map((p) =>
      p.catch((e) => ({
        status: 0,
        wallMs: null,
        error: e.message,
        cache: null,
        sqlCount: null,
      })),
    ),
  );
  return {
    label,
    path: pathname,
    concurrency: n,
    elapsedMs: Date.now() - started,
    summary: summarize(samples),
  };
}

async function main() {
  const users = await pickCookie();
  const report = {
    measuredAt: new Date().toISOString(),
    baseUrl,
    concurrency,
    users: users.map((u) => u.userIdPrefix),
    note: "Pool max serverless permanece 2. Erros 5xx/timeout sao MEDIDOS.",
    scenarios: [],
  };

  // 1) Mesmo usuario, N paralelo por endpoint
  for (const ep of ENDPOINTS) {
    report.scenarios.push(await burst(`same-user:${ep}`, ep, [users[0]], concurrency));
  }

  // 2) Mix de endpoints em paralelo (mesmo usuario)
  {
    const jobs = [];
    for (let i = 0; i < concurrency; i += 1) {
      jobs.push(request(ENDPOINTS[i % ENDPOINTS.length], users[0].cookie));
    }
    const started = Date.now();
    const samples = await Promise.all(
      jobs.map((p) =>
        p.catch((e) => ({ status: 0, wallMs: null, error: e.message, cache: null, sqlCount: null })),
      ),
    );
    report.scenarios.push({
      label: "same-user:mixed-endpoints",
      concurrency,
      elapsedMs: Date.now() - started,
      summary: summarize(samples),
    });
  }

  // 3) Dois usuarios (se existirem) em paralelo no /home
  if (users.length >= 2) {
    report.scenarios.push(
      await burst("two-users:/api/home", "/api/home", users, concurrency),
    );
  } else {
    report.scenarios.push({
      label: "two-users:/api/home",
      skipped: true,
      reason: "apenas 1 usuario ativo no banco",
    });
  }

  const totalErrors = report.scenarios.reduce(
    (acc, s) => acc + (s.summary?.errors || 0),
    0,
  );
  report.verdict = {
    totalErrors,
    poolMaxUnchanged: 2,
    ok: totalErrors === 0,
  };

  console.log(JSON.stringify(report, null, 2));
  const pool = require("../backend/src/database/pool");
  await pool.end?.();
  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
