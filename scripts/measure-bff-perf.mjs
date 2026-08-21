/**
 * Medicao local dos headers X-BFF-* (Etapa 10).
 *
 * Uso:
 *   node scripts/measure-bff-perf.mjs
 *   node scripts/measure-bff-perf.mjs --base http://127.0.0.1:3045
 *
 * Sem --base: sobe a app em porta efemera (processo fresco → 1ª req tende a warm=0).
 * Com --base: usa API ja rodando (tipicamente warm=1).
 *
 * Nao imprime dados sensiveis do usuario alem do id truncado.
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
const externalBase = baseIdx >= 0 ? args[baseIdx + 1] : null;
const rounds = Number(args.includes("--rounds") ? args[args.indexOf("--rounds") + 1] : 3) || 3;

const ENDPOINTS = [
  { name: "home", path: "/api/home" },
  { name: "home-secondary", path: "/api/home/secondary" },
  { name: "dashboard", path: "/api/dashboard?period=30d" },
  { name: "dashboard-section-general", path: "/api/dashboard?period=30d&section=general" },
  { name: "insights", path: "/api/insights" },
  { name: "accounts", path: "/api/accounts" },
  { name: "transactions", path: "/api/transactions" },
  { name: "investments", path: "/api/investments" },
];

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function request(baseUrl, pathname, cookie) {
  const url = new URL(pathname, baseUrl);
  const lib = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          Cookie: cookie,
          Accept: "application/json",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function pickUserAndToken() {
  const pool = require("../backend/src/database/pool");
  const { signAccessToken } = require("../backend/src/utils/jwt");
  const { ACCOUNT_STATUS } = require("../backend/src/modules/auth/constants");

  const { rows } = await pool.query(
    `SELECT id, email, papel AS role, status, nome
     FROM usuarios
     WHERE status = $1
     ORDER BY created_at ASC NULLS LAST
     LIMIT 1`,
    [ACCOUNT_STATUS.ACTIVE],
  );

  if (!rows.length) {
    throw new Error("Nenhum usuario ativo em usuarios — rode o seed ou registre um usuario.");
  }

  const user = rows[0];
  const token = signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.nome || null,
    role: user.role || "USER",
    status: user.status,
    emailVerified: true,
  });

  return { user, cookie: `finsight_access=${token}` };
}

async function main() {
  let server;
  let baseUrl = externalBase;

  if (!baseUrl) {
    process.env.NODE_ENV = process.env.NODE_ENV || "development";
    const app = require("../backend/src/app");
    server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  }

  const { user, cookie } = await pickUserAndToken();
  console.log(
    JSON.stringify(
      {
        mode: externalBase ? "external" : "ephemeral",
        baseUrl,
        rounds,
        userIdPrefix: String(user.id).slice(0, 8),
        note: "Valores MEDIDOS via X-BFF-* headers. GET /api/analytics nao existe; use dashboard?section=.",
      },
      null,
      2,
    ),
  );

  const report = [];

  for (const ep of ENDPOINTS) {
    const samples = [];
    for (let i = 0; i < rounds; i += 1) {
      const res = await request(baseUrl, ep.path, cookie);
      samples.push({
        status: res.status,
        durationMs: (() => {
          const n = Number(res.headers["x-bff-duration-ms"]);
          return Number.isFinite(n) ? n : null;
        })(),
        sqlCount: (() => {
          const raw = res.headers["x-bff-sql-count"];
          if (raw === undefined || raw === null) return null;
          const n = Number(raw);
          return Number.isFinite(n) ? n : null;
        })(),
        sqlMs: (() => {
          const raw = res.headers["x-bff-sql-ms"];
          if (raw === undefined || raw === null) return null;
          const n = Number(raw);
          return Number.isFinite(n) ? n : null;
        })(),
        cache: res.headers["x-bff-cache"] || null,
        warm: res.headers["x-bff-warm"] || null,
        endpoint: res.headers["x-bff-endpoint"] || null,
      });
    }

    const ok = samples.filter((s) => s.status === 200 && s.durationMs != null);
    const durations = ok.map((s) => s.durationMs).sort((a, b) => a - b);
    const sqlCounts = ok.map((s) => s.sqlCount).filter((n) => Number.isFinite(n));

    report.push({
      name: ep.name,
      path: ep.path,
      samples,
      summary: {
        status: samples.map((s) => s.status),
        measured: ok.length > 0,
        p50Ms: percentile(durations, 50),
        p95Ms: percentile(durations, 95),
        sqlCountMin: sqlCounts.length ? Math.min(...sqlCounts) : null,
        sqlCountMax: sqlCounts.length ? Math.max(...sqlCounts) : null,
        cache: [...new Set(ok.map((s) => s.cache))],
        warm: [...new Set(ok.map((s) => s.warm))],
      },
    });
  }

  console.log(JSON.stringify({ results: report }, null, 2));

  if (server) {
    await new Promise((resolve) => server.close(resolve));
    const pool = require("../backend/src/database/pool");
    await pool.end?.();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
