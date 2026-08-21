/**
 * Baseline de volume + indices do PostgreSQL (SEM dados financeiros/PII).
 *
 * Uso:
 *   node --env-file=backend/.env scripts/fase4-db-baseline.mjs
 *   node --env-file=backend/.env.vercel scripts/fase4-db-baseline.mjs
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const pool = require("../backend/src/database/pool");

const TABLES = [
  "movimentacoes",
  "contas",
  "cartoes",
  "faturas",
  "investimentos",
  "market_data",
  "market_history",
  "recorrencias",
  "regras_orcamento",
  "historico_saude_financeira",
  "perfil_financeiro",
  "metas",
  "usuarios",
];

async function main() {
  const { rows: sizeRows } = await pool.query(
    `
      SELECT
        s.relname AS table,
        s.n_live_tup::bigint AS est_live_rows,
        pg_total_relation_size(c.oid)::bigint AS total_bytes,
        pg_relation_size(c.oid)::bigint AS table_bytes,
        pg_indexes_size(c.oid)::bigint AS indexes_bytes
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND s.relname = ANY($1::text[])
      ORDER BY pg_total_relation_size(c.oid) DESC
    `,
    [TABLES],
  );

  const counts = {};
  for (const table of TABLES) {
    try {
      const { rows } = await pool.query(`SELECT COUNT(*)::bigint AS n FROM ${table}`);
      counts[table] = Number(rows[0].n);
    } catch {
      counts[table] = null;
    }
  }

  const { rows: indexes } = await pool.query(
    `
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
      ORDER BY tablename, indexname
    `,
    [TABLES],
  );

  let hostHint = "(?)";
  try {
    hostHint = new URL(process.env.DATABASE_URL).hostname;
  } catch {
    /* ignore */
  }

  console.log(
    JSON.stringify(
      {
        hostHint,
        sslInsecure: process.env.DATABASE_SSL_INSECURE === "true",
        tables: sizeRows.map((r) => ({
          table: r.table,
          countExact: counts[r.table],
          estLiveRows: Number(r.est_live_rows),
          totalKb: Math.round(Number(r.total_bytes) / 1024),
          tableKb: Math.round(Number(r.table_bytes) / 1024),
          indexesKb: Math.round(Number(r.indexes_bytes) / 1024),
        })),
        indexCount: indexes.length,
        indexes: indexes.map((i) => ({
          table: i.tablename,
          index: i.indexname,
        })),
      },
      null,
      2,
    ),
  );

  await pool.end();
}

main().catch(async (e) => {
  console.error(e.message);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
