const { Pool } = require("pg");

const env = require("../config/env");

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

module.exports = pool;
