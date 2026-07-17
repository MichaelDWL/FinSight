const { Pool } = require("pg");

const env = require("../config/env");
const { recordQuery } = require("../modules/bff/monitoring/sql.tracker");

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL nao configurada.");
}

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.dbPoolMax,
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
