/**
 * FASE 5 — Etapa 3: baseline COLD vs WARM em producao.
 *
 * Metodologia:
 * 1. Mede wall-clock do cliente E headers X-BFF-* do servidor.
 * 2. Nao confunde lentidao com cold start: classifica por X-BFF-Warm + cache + SQL.
 * 3. Sequencia 1a / 2a / 3a request por endpoint.
 * 4. Opcional: --idle-sec N espera inatividade e re-mede (tenta capturar cold).
 *
 * Uso:
 *   node --env-file=backend/.env.vercel scripts/measure-cold-warm.mjs
 *   node --env-file=backend/.env.vercel scripts/measure-cold-warm.mjs --idle-sec 420
 *
 * Nao imprime PII / tokens / payloads financeiros.
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
const rounds = Number(args.includes("--rounds") ? args[args.indexOf("--rounds") + 1] : 3) || 3;
const idleSec = Number(args.includes("--idle-sec") ? args[args.indexOf("--idle-sec") + 1] : 0) || 0;

const ENDPOINTS = [
  { name: "home", path: "/api/home" },
  { name: "home-secondary", path: "/api/home/secondary" },
  { name: "dashboard", path: "/api/dashboard?period=30d" },
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

function request(pathname, cookie, method = "GET") {
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
        method,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          Accept: "application/json",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const wallMs = Number(process.hrtime.bigint() - wallStart) / 1e6;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            wallMs: Math.round(wallMs * 100) / 100,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(120_000, () => {
      req.destroy(new Error(`timeout ${pathname}`));
    });
    req.end();
  });
}

function numHeader(headers, name) {
  const raw = headers[name];
  if (raw === undefined || raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function sampleFromRes(res, seq) {
  const serverMs = numHeader(res.headers, "x-bff-duration-ms");
  const sqlMs = numHeader(res.headers, "x-bff-sql-ms");
  const serializeMs = numHeader(res.headers, "x-bff-serialize-ms");
  return {
    seq,
    status: res.status,
    wallMs: res.wallMs,
    serverMs,
    /** ESTIMADO: wall - server (rede + TLS edge + fila + cold bootstrap fora do monitor). */
    overheadMs:
      serverMs != null ? Math.round((res.wallMs - serverMs) * 100) / 100 : null,
    sqlCount: numHeader(res.headers, "x-bff-sql-count"),
    sqlMs,
    serializeMs,
    cache: res.headers["x-bff-cache"] || null,
    warm: res.headers["x-bff-warm"] || null,
    uptimeSec: numHeader(res.headers, "x-bff-uptime-sec"),
    endpoint: res.headers["x-bff-endpoint"] || null,
  };
}

function summarize(samples) {
  const ok = samples.filter((s) => s.status === 200);
  const walls = ok.map((s) => s.wallMs).sort((a, b) => a - b);
  const servers = ok.map((s) => s.serverMs).filter((n) => n != null).sort((a, b) => a - b);
  const sqlMs = ok.map((s) => s.sqlMs).filter((n) => n != null);
  return {
    n: samples.length,
    ok: ok.length,
    wallP50: percentile(walls, 50),
    wallP95: percentile(walls, 95),
    serverP50: percentile(servers, 50),
    serverP95: percentile(servers, 95),
    sqlMsMax: sqlMs.length ? Math.max(...sqlMs) : null,
    warmFlags: [...new Set(ok.map((s) => s.warm))],
    cacheFlags: [...new Set(ok.map((s) => s.cache))],
    byClass: {
      cold: ok.filter((s) => s.warm === "0").length,
      warmMiss: ok.filter((s) => s.warm === "1" && s.cache === "MISS").length,
      warmHit: ok.filter((s) => s.warm === "1" && s.cache === "HIT").length,
      unclassified: ok.filter((s) => s.warm !== "0" && s.warm !== "1").length,
    },
  };
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
  if (!rows.length) throw new Error("Nenhum usuario ativo.");
  const user = rows[0];
  const token = signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.nome || null,
    role: user.role || "USER",
    status: user.status,
    emailVerified: true,
  });
  return { userIdPrefix: String(user.id).slice(0, 8), cookie: `finsight_access=${token}` };
}

async function measureReady(label, n = 3) {
  const samples = [];
  for (let i = 1; i <= n; i += 1) {
    const res = await request("/ready", null);
    let dbMs = null;
    let ssl = null;
    try {
      const json = JSON.parse(res.body);
      dbMs = json?.data?.database?.responseTimeMs ?? null;
      ssl = json?.data?.database?.ssl ?? null;
    } catch {
      /* ignore */
    }
    samples.push({
      seq: i,
      status: res.status,
      wallMs: res.wallMs,
      dbMs,
      sslEnabled: ssl && typeof ssl === "object" ? ssl.enabled : ssl,
      rejectUnauthorized: ssl && typeof ssl === "object" ? ssl.rejectUnauthorized : null,
      caProvided: ssl && typeof ssl === "object" ? ssl.caProvided : null,
    });
  }
  return { label, samples, summary: summarize(samples.map((s) => ({ ...s, serverMs: s.dbMs, warm: null, cache: null }))) };
}

async function measureEndpoints(label, cookie) {
  const results = [];
  for (const ep of ENDPOINTS) {
    const samples = [];
    for (let i = 1; i <= rounds; i += 1) {
      const res = await request(ep.path, cookie);
      samples.push(sampleFromRes(res, i));
    }
    results.push({
      name: ep.name,
      path: ep.path,
      samples,
      summary: summarize(samples),
      firstThree: samples.slice(0, 3).map((s) => ({
        seq: s.seq,
        wallMs: s.wallMs,
        serverMs: s.serverMs,
        overheadMs: s.overheadMs,
        sqlCount: s.sqlCount,
        sqlMs: s.sqlMs,
        cache: s.cache,
        warm: s.warm,
        uptimeSec: s.uptimeSec,
      })),
    });
  }
  return { label, results };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { userIdPrefix, cookie } = await pickUserAndToken();

  const report = {
    methodology: {
      baseUrl,
      rounds,
      idleSec,
      classifications: {
        cold: "X-BFF-Warm=0 (processo ainda nao serviu BFF antes — apos deploy do monitor Etapa 3)",
        warmMiss: "X-BFF-Warm=1 + X-BFF-Cache=MISS",
        warmHit: "X-BFF-Warm=1 + X-BFF-Cache=HIT",
        overheadMs: "ESTIMADO = wallMs cliente - X-BFF-Duration-Ms (rede/edge/bootstrap fora do monitor)",
      },
      note: "Lentidao sozinha NAO prova cold start. Separar warm flag, cache, SQL e overhead.",
    },
    meta: {
      userIdPrefix,
      measuredAt: new Date().toISOString(),
    },
    phases: {},
  };

  report.phases.readyBefore = await measureReady("ready-before", 3);
  report.phases.burst = await measureEndpoints("burst-sequential", cookie);

  if (idleSec > 0) {
    console.error(`[measure-cold-warm] aguardando idle ${idleSec}s para tentar cold start...`);
    await sleep(idleSec * 1000);
    report.phases.readyAfterIdle = await measureReady("ready-after-idle", 2);
    report.phases.afterIdle = await measureEndpoints("after-idle", cookie);
  }

  console.log(JSON.stringify(report, null, 2));

  const pool = require("../backend/src/database/pool");
  await pool.end?.();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
