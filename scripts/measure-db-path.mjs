/**
 * FASE 5 — Etapa 6: decompor custo de conexao PostgreSQL.
 *
 * Mede LOCALMENTE contra DATABASE_URL (tipicamente pooler .env.vercel):
 * - DNS
 * - TCP connect
 * - Client.connect (TCP ja aberto + SSLRequest + TLS + auth — PG nao aceita TLS cru)
 * - 1a query vs reuso (mesma Client)
 * - Pool: 1a acquire+query vs 2a/3a
 *
 * NAO imprime secrets. NAO e cold start Vercel.
 *
 * Uso:
 *   node --env-file=backend/.env.vercel scripts/measure-db-path.mjs
 */
import dns from "node:dns/promises";
import net from "node:net";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Pool } from "pg";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const { buildSslConfig, describeSslMode } = require("../backend/src/database/sslConfig");

function hr() {
  return process.hrtime.bigint();
}
function msSince(start) {
  return Math.round((Number(hr() - start) / 1e6) * 100) / 100;
}

function parseDbUrl(raw) {
  const u = new URL(raw);
  return {
    hostname: u.hostname,
    port: Number(u.port || 5432),
    database: u.pathname.replace(/^\//, "") || "postgres",
    isPooler: u.port === "6543" || u.hostname.includes("pooler"),
    isDirect: u.port === "5432" && !u.hostname.includes("pooler"),
  };
}

async function measureDns(hostname) {
  const t0 = hr();
  const result = await dns.lookup(hostname, { all: false });
  return { ms: msSince(t0), family: result.family };
}

function measureTcp(hostname, port) {
  return new Promise((resolve, reject) => {
    const t0 = hr();
    const socket = net.connect({ host: hostname, port }, () => {
      const connectMs = msSince(t0);
      socket.end();
      resolve({ ms: connectMs });
    });
    socket.setTimeout(15_000, () => {
      socket.destroy();
      reject(new Error("TCP timeout"));
    });
    socket.on("error", reject);
  });
}

async function measureClientQueries(connectionString, ssl) {
  const client = new Client({
    connectionString,
    ssl,
    connectionTimeoutMillis: 20_000,
  });
  const tConnect = hr();
  await client.connect();
  const connectMs = msSince(tConnect);

  const samples = [];
  for (let i = 1; i <= 5; i += 1) {
    const tq = hr();
    await client.query("SELECT 1 AS n");
    samples.push({ seq: i, queryMs: msSince(tq) });
  }
  await client.end();
  return { connectMs, samples };
}

async function measurePool(connectionString, ssl) {
  const pool = new Pool({
    connectionString,
    ssl,
    max: 2,
    connectionTimeoutMillis: 20_000,
    idleTimeoutMillis: 10_000,
  });
  const samples = [];
  for (let i = 1; i <= 5; i += 1) {
    const t0 = hr();
    const client = await pool.connect();
    const acquireMs = msSince(t0);
    const tq = hr();
    await client.query("SELECT 1 AS n");
    const queryMs = msSince(tq);
    client.release();
    samples.push({
      seq: i,
      acquireMs,
      queryMs,
      totalMs: Math.round((acquireMs + queryMs) * 100) / 100,
    });
  }
  await pool.end();
  return { samples };
}

function p50(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL ausente");
    process.exit(2);
  }

  const meta = parseDbUrl(url);
  const sslBuilt = buildSslConfig({
    databaseSsl: process.env.DATABASE_SSL === "true",
    databaseSslInsecure: process.env.DATABASE_SSL_INSECURE === "true",
    databaseSslCa: process.env.DATABASE_SSL_CA || null,
    databaseSslCaFile:
      process.env.DATABASE_SSL_CA_FILE ||
      "backend/certs/supabase-root-2021-ca.crt",
    isProduction: true,
  });
  const sslMode = describeSslMode(sslBuilt);
  const pgSsl = sslBuilt
    ? {
        rejectUnauthorized: sslBuilt.rejectUnauthorized !== false,
        ...(sslBuilt.ca ? { ca: sslBuilt.ca } : {}),
      }
    : false;

  const report = {
    note: "LOCAL→Supabase. TLS isolado via tls.connect nao se aplica ao protocolo PG (SSLRequest). client.connect inclui TLS+auth.",
    measuredAt: new Date().toISOString(),
    target: {
      hostname: meta.hostname,
      port: meta.port,
      database: meta.database,
      isPooler: meta.isPooler,
      isDirect: meta.isDirect,
      ssl: sslMode,
    },
    phases: {},
  };

  report.phases.dns = await measureDns(meta.hostname);
  report.phases.tcp = await measureTcp(meta.hostname, meta.port);
  report.phases.client = await measureClientQueries(url, pgSsl);
  report.phases.pool = await measurePool(url, pgSsl);

  const poolWarm = report.phases.pool.samples.slice(1);
  report.interpretation = {
    dnsMs: report.phases.dns.ms,
    tcpMs: report.phases.tcp.ms,
    /** MEDIDO: connect PG = socket + SSLRequest + TLS + auth */
    clientConnectMs: report.phases.client.connectMs,
    /** ESTIMADO: connect − TCP (TLS+auth+startup), DNS separado */
    tlsAuthStartupEstMs: Math.max(
      0,
      Math.round((report.phases.client.connectMs - report.phases.tcp.ms) * 100) / 100,
    ),
    firstQueryOnOpenClientMs: report.phases.client.samples[0]?.queryMs,
    reusedClientQueryP50Ms: p50(report.phases.client.samples.slice(1).map((s) => s.queryMs)),
    poolFirstAcquireMs: report.phases.pool.samples[0]?.acquireMs,
    poolFirstQueryMs: report.phases.pool.samples[0]?.queryMs,
    poolWarmAcquireP50Ms: p50(poolWarm.map((s) => s.acquireMs)),
    poolWarmQueryP50Ms: p50(poolWarm.map((s) => s.queryMs)),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, message: err.message, code: err.code || null }));
  process.exit(1);
});
