/**
 * Lista indices publicos e roda EXPLAIN (sem ANALYZE por padrao) em queries criticas.
 * Uso: node scripts/fase3-explain.mjs
 *      node scripts/fase3-explain.mjs --analyze   # somente SELECTs; seguro
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const pool = require("../backend/src/database/pool");
const withAnalyze = process.argv.includes("--analyze");
const explainPrefix = withAnalyze
  ? "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)"
  : "EXPLAIN (FORMAT TEXT)";

async function getUserId() {
  const { rows } = await pool.query(
    `SELECT id::text AS id FROM usuarios ORDER BY created_at ASC LIMIT 1`,
  );
  return rows[0]?.id || null;
}

function summarizePlan(lines) {
  const text = lines.join("\n");
  return {
    hasSeqScan: /Seq Scan/i.test(text),
    hasIndexScan: /Index Scan|Index Only Scan|Bitmap Index Scan/i.test(text),
    hasBitmapHeap: /Bitmap Heap Scan/i.test(text),
    hasSort: /\bSort\b/i.test(text),
    hasHashJoin: /Hash Join/i.test(text),
    hasNestedLoop: /Nested Loop/i.test(text),
    hasAggregate: /Aggregate|GroupAggregate|HashAggregate/i.test(text),
    planningMs: (text.match(/Planning Time:\s*([\d.]+)/i) || [])[1] || null,
    executionMs: (text.match(/Execution Time:\s*([\d.]+)/i) || [])[1] || null,
    cost: (text.match(/cost=([\d.]+)\.\.([\d.]+)/) || []).slice(1, 3),
    planHead: lines.slice(0, 12),
  };
}

const queries = (userId) => [
  {
    name: "home-financial-summaries",
    endpoint: "home",
    sql: `
      WITH bounds AS (
        SELECT
          date_trunc('month', CURRENT_DATE)::date AS current_month,
          (date_trunc('month', CURRENT_DATE) - interval '1 month')::date AS previous_month,
          (date_trunc('month', CURRENT_DATE) + interval '1 month')::date AS next_month
      )
      SELECT COUNT(*)::int AS n
      FROM movimentacoes m
      CROSS JOIN bounds b
      WHERE m.usuario_id = $1
        AND m.data_transacao >= b.previous_month
        AND m.data_transacao < b.next_month
    `,
    params: [userId],
  },
  {
    name: "accounts-findAll-stats",
    endpoint: "accounts",
    sql: `
      SELECT COUNT(*)::int AS n
      FROM movimentacoes m
      WHERE m.usuario_id = $1
        AND m.conta_id IS NOT NULL
    `,
    params: [userId],
  },
  {
    name: "movimentacoes-month-range",
    endpoint: "dashboard/analytics",
    sql: `
      SELECT m.tipo, m.status, SUM(m.valor) AS total
      FROM movimentacoes m
      WHERE m.usuario_id = $1
        AND m.data_transacao >= date_trunc('month', CURRENT_DATE)::date
        AND m.data_transacao < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
      GROUP BY m.tipo, m.status
    `,
    params: [userId],
  },
  {
    name: "movimentacoes-list-recent",
    endpoint: "home/transactions",
    sql: `
      SELECT m.id
      FROM movimentacoes m
      WHERE m.usuario_id = $1
        AND m.excluido_em IS NULL
      ORDER BY m.data_transacao DESC, m.created_at DESC
      LIMIT 6
    `,
    params: [userId],
  },
  {
    name: "investimentos-by-user",
    endpoint: "investments",
    sql: `
      SELECT id, asset_code, valor_atual
      FROM investimentos
      WHERE usuario_id = $1
      ORDER BY created_at ASC
      LIMIT 100
    `,
    params: [userId],
  },
  {
    name: "market-history-batch-shape",
    endpoint: "investments/market",
    sql: `
      SELECT asset_code, date, price
      FROM market_history
      WHERE asset_code = ANY($1::text[])
      ORDER BY asset_code, date DESC
      LIMIT 500
    `,
    params: [["PETR4", "VALE3"]],
  },
  {
    name: "regras-orcamento-mes",
    endpoint: "insights/personalization",
    sql: `
      SELECT *
      FROM regras_orcamento
      WHERE usuario_id = $1
        AND mes_referencia = date_trunc('month', CURRENT_DATE)::date
    `,
    params: [userId],
  },
  {
    name: "historico-saude-365",
    endpoint: "insights/personalization",
    sql: `
      SELECT registrado_em, pontuacao
      FROM historico_saude_financeira
      WHERE usuario_id = $1
        AND registrado_em >= (CURRENT_DATE - interval '365 days')
      ORDER BY registrado_em ASC
    `,
    params: [userId],
  },
  {
    name: "recorrencias-due",
    endpoint: "cron/recurrences",
    sql: `
      SELECT id
      FROM recorrencias
      WHERE usuario_id = $1
        AND ativa = true
        AND proxima_geracao <= (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date
    `,
    params: [userId],
  },
  {
    name: "cartoes-with-faturas",
    endpoint: "cards",
    sql: `
      SELECT c.id, COALESCE(SUM(f.valor_total), 0) AS total
      FROM cartoes c
      LEFT JOIN faturas f ON f.cartao_id = c.id
      WHERE c.usuario_id = $1
      GROUP BY c.id
    `,
    params: [userId],
  },
];

async function main() {
  const { rows: indexes } = await pool.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);

  const userId = await getUserId();
  if (!userId) {
    console.error("Nenhum usuario encontrado para EXPLAIN.");
    process.exit(2);
  }

  const explains = [];
  for (const q of queries(userId)) {
    const { rows } = await pool.query(`${explainPrefix} ${q.sql}`, q.params);
    const lines = rows.map((r) => r["QUERY PLAN"]);
    explains.push({
      name: q.name,
      endpoint: q.endpoint,
      summary: summarizePlan(lines),
      plan: lines,
    });
  }

  const ranking = [...explains].sort((a, b) => {
    const ae = Number(a.summary.executionMs || a.summary.cost?.[1] || 0);
    const be = Number(b.summary.executionMs || b.summary.cost?.[1] || 0);
    return be - ae;
  });

  console.log(
    JSON.stringify(
      {
        mode: withAnalyze ? "ANALYZE+BUFFERS" : "EXPLAIN-only",
        userIdPrefix: String(userId).slice(0, 8),
        indexCount: indexes.length,
        indexes: indexes.map((i) => ({
          table: i.tablename,
          index: i.indexname,
          def: i.indexdef,
        })),
        explains,
        ranking: ranking.map((r) => ({
          name: r.name,
          endpoint: r.endpoint,
          seqScan: r.summary.hasSeqScan,
          indexScan: r.summary.hasIndexScan,
          executionMs: r.summary.executionMs,
          cost: r.summary.cost,
        })),
      },
      null,
      2,
    ),
  );

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
