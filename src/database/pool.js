const { Pool } = require("pg");

const env = require("../config/env");
const { isServerless } = require("../platform/runtime");
const { recordQuery } = require("../modules/bff/monitoring/sql.tracker");

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL nao configurada.");
}

/**
 * Pool reutilizavel entre warm invocations.
 * Em serverless: poucas conexoes por instancia (evita esgotar o Postgres).
 * Em long-running: DB_POOL_MAX (default 10).
 */
const poolMax = isServerless
  ? Math.min(env.dbPoolMax, env.dbPoolMaxServerless || 2)
  : env.dbPoolMax;

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: poolMax,
  idleTimeoutMillis: isServerless ? 5_000 : 30_000,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: isServerless,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : false,
});

pool.on("error", (error) => {
  console.error("[database] erro inesperado no pool", error);
});

const originalQuery = pool.query.bind(pool);

pool.query = async function trackedQuery(...args) {
  const started = process.hrtime.bigint();
  try {
    const result = await originalQuery(...args);
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    const rowCount = Array.isArray(result?.rows)
      ? result.rows.length
      : Number(result?.rowCount) || 0;
    recordQuery({ durationMs, rowCount });
    return result;
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    recordQuery({ durationMs, rowCount: 0 });
    throw error;
  }
};

module.exports = pool;
