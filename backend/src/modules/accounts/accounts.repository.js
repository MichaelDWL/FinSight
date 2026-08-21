const pool = require("../../database/pool");

const SETTLED = "('confirmada', 'paga')";
const OUTFLOW_TYPES = "('despesa', 'recorrencia', 'pagamento_fatura')";

function mapAccount(row) {
  return {
    id: row.id,
    icon: row.icone || "bank",
    name: row.nome,
    type: row.tipo,
    institution: row.instituicao || "",
    balance: Number(row.saldo_atual),
    color: row.cor || "#0d6efd",
    notes: row.observacao || "",
    status: row.status,
    monthIncome: Number(row.receitas_mes || 0),
    monthExpenses: Number(row.despesas_mes || 0),
    lastMovement: row.ultima_movimentacao || null,
    movementsCount: Number(row.total_movimentacoes || 0),
  };
}

/** Conta leve para shell/Home — sem stats de movimentacoes. */
function mapAccountSummary(row) {
  return {
    id: row.id,
    icon: row.icone || "bank",
    name: row.nome,
    type: row.tipo,
    institution: row.instituicao || "",
    balance: Number(row.saldo_atual),
    color: row.cor || "#0d6efd",
    notes: row.observacao || "",
    status: row.status,
    monthIncome: 0,
    monthExpenses: 0,
    lastMovement: null,
    movementsCount: 0,
  };
}

// Classifica a movimentacao em relacao a conta consultada (entrada/saida) para
// exibir o historico com o sinal correto na tela de detalhes.
function mapMovement(row, accountId) {
  const isTransfer = row.tipo === "transferencia";
  const inflow = row.tipo === "receita" || (isTransfer && row.conta_destino_id === accountId);
  const value = Number(row.valor);

  return {
    id: row.id,
    description: row.descricao,
    category: row.categoria || null,
    type: row.tipo,
    flow: inflow ? "in" : "out",
    value: inflow ? value : -value,
    date: row.data_transacao,
    status: row.status,
  };
}

async function findAll(userId) {
  const { rows } = await pool.query(
    `
      WITH month_bounds AS (
        SELECT
          date_trunc('month', CURRENT_DATE)::date AS month_start,
          (date_trunc('month', CURRENT_DATE) + interval '1 month')::date AS next_month_start
      ),
      account_stats AS (
        SELECT
          account_id,
          SUM(month_income)::numeric AS receitas_mes,
          SUM(month_expenses)::numeric AS despesas_mes,
          MAX(last_movement) AS ultima_movimentacao,
          SUM(movement_count)::int AS total_movimentacoes
        FROM (
          SELECT
            m.conta_id AS account_id,
            SUM(
              CASE
                WHEN m.status IN ${SETTLED}
                  AND m.data_transacao >= mb.month_start
                  AND m.data_transacao < mb.next_month_start
                  AND m.tipo IN ${OUTFLOW_TYPES}
                THEN m.valor
                WHEN m.status IN ${SETTLED}
                  AND m.data_transacao >= mb.month_start
                  AND m.data_transacao < mb.next_month_start
                  AND m.tipo = 'transferencia'
                THEN m.valor
                ELSE 0
              END
            ) AS month_expenses,
            SUM(
              CASE
                WHEN m.status IN ${SETTLED}
                  AND m.data_transacao >= mb.month_start
                  AND m.data_transacao < mb.next_month_start
                  AND m.tipo = 'receita'
                THEN m.valor
                ELSE 0
              END
            ) AS month_income,
            MAX(m.data_transacao) AS last_movement,
            COUNT(*) AS movement_count
          FROM movimentacoes m
          CROSS JOIN month_bounds mb
          WHERE m.usuario_id = $1
            AND m.conta_id IS NOT NULL
          GROUP BY m.conta_id

          UNION ALL

          SELECT
            m.conta_destino_id AS account_id,
            0::numeric AS month_expenses,
            SUM(
              CASE
                WHEN m.status IN ${SETTLED}
                  AND m.data_transacao >= mb.month_start
                  AND m.data_transacao < mb.next_month_start
                  AND m.tipo = 'transferencia'
                THEN m.valor
                ELSE 0
              END
            ) AS month_income,
            MAX(m.data_transacao) AS last_movement,
            COUNT(*) AS movement_count
          FROM movimentacoes m
          CROSS JOIN month_bounds mb
          WHERE m.usuario_id = $1
            AND m.conta_destino_id IS NOT NULL
          GROUP BY m.conta_destino_id
        ) aggregated
        GROUP BY account_id
      )
      SELECT
        c.id, c.nome, c.tipo, c.instituicao, c.saldo_atual, c.cor, c.icone, c.observacao, c.status,
        COALESCE(s.receitas_mes, 0) AS receitas_mes,
        COALESCE(s.despesas_mes, 0) AS despesas_mes,
        s.ultima_movimentacao,
        COALESCE(s.total_movimentacoes, 0) AS total_movimentacoes
      FROM contas c
      LEFT JOIN account_stats s ON s.account_id = c.id
      WHERE c.usuario_id = $1
      ORDER BY c.created_at ASC
    `,
    [userId]
  );

  return rows.map(mapAccount);
}

/**
 * Lista enxuta: apenas colunas de contas (sem CTE/scan de movimentacoes).
 * Adequada para Home shell e wealthBreakdown (id, type, balance, ...).
 */
async function findSummary(userId) {
  const { rows } = await pool.query(
    `
      SELECT
        c.id, c.nome, c.tipo, c.instituicao, c.saldo_atual,
        c.cor, c.icone, c.observacao, c.status
      FROM contas c
      WHERE c.usuario_id = $1
      ORDER BY c.created_at ASC
    `,
    [userId],
  );

  return rows.map(mapAccountSummary);
}

async function findById(userId, id) {
  // Stats via agregacao unica (JOIN/GROUP), equivalente ao findAll — sem subqueries correlacionadas.
  const { rows } = await pool.query(
    `
      WITH month_bounds AS (
        SELECT
          date_trunc('month', CURRENT_DATE)::date AS month_start,
          (date_trunc('month', CURRENT_DATE) + interval '1 month')::date AS next_month_start
      ),
      account_stats AS (
        SELECT
          SUM(month_income)::numeric AS receitas_mes,
          SUM(month_expenses)::numeric AS despesas_mes,
          MAX(last_movement) AS ultima_movimentacao,
          SUM(movement_count)::int AS total_movimentacoes
        FROM (
          SELECT
            SUM(
              CASE
                WHEN m.status IN ${SETTLED}
                  AND m.data_transacao >= mb.month_start
                  AND m.data_transacao < mb.next_month_start
                  AND m.tipo IN ${OUTFLOW_TYPES}
                THEN m.valor
                WHEN m.status IN ${SETTLED}
                  AND m.data_transacao >= mb.month_start
                  AND m.data_transacao < mb.next_month_start
                  AND m.tipo = 'transferencia'
                THEN m.valor
                ELSE 0
              END
            ) AS month_expenses,
            SUM(
              CASE
                WHEN m.status IN ${SETTLED}
                  AND m.data_transacao >= mb.month_start
                  AND m.data_transacao < mb.next_month_start
                  AND m.tipo = 'receita'
                THEN m.valor
                ELSE 0
              END
            ) AS month_income,
            MAX(m.data_transacao) AS last_movement,
            COUNT(*) AS movement_count
          FROM movimentacoes m
          CROSS JOIN month_bounds mb
          WHERE m.usuario_id = $1
            AND m.conta_id = $2

          UNION ALL

          SELECT
            0::numeric AS month_expenses,
            SUM(
              CASE
                WHEN m.status IN ${SETTLED}
                  AND m.data_transacao >= mb.month_start
                  AND m.data_transacao < mb.next_month_start
                  AND m.tipo = 'transferencia'
                THEN m.valor
                ELSE 0
              END
            ) AS month_income,
            MAX(m.data_transacao) AS last_movement,
            COUNT(*) AS movement_count
          FROM movimentacoes m
          CROSS JOIN month_bounds mb
          WHERE m.usuario_id = $1
            AND m.conta_destino_id = $2
        ) aggregated
      )
      SELECT
        c.id, c.nome, c.tipo, c.instituicao, c.saldo_atual, c.cor, c.icone, c.observacao, c.status,
        COALESCE(s.receitas_mes, 0) AS receitas_mes,
        COALESCE(s.despesas_mes, 0) AS despesas_mes,
        s.ultima_movimentacao,
        COALESCE(s.total_movimentacoes, 0) AS total_movimentacoes
      FROM contas c
      LEFT JOIN account_stats s ON true
      WHERE c.usuario_id = $1 AND c.id = $2
    `,
    [userId, id]
  );

  if (!rows[0]) return null;

  const account = mapAccount(rows[0]);

  const movements = await pool.query(
    `
      SELECT
        m.id, m.descricao, m.tipo, m.valor, m.data_transacao, m.status,
        m.conta_id, m.conta_destino_id,
        cat.nome AS categoria
      FROM movimentacoes m
      LEFT JOIN categorias cat ON cat.id = m.categoria_id
      WHERE m.usuario_id = $1
        AND m.excluido_em IS NULL
        AND (m.conta_id = $2 OR m.conta_destino_id = $2)
      ORDER BY m.data_transacao DESC, m.created_at DESC
      LIMIT $3
    `,
    [userId, id, 100]
  );

  account.movements = movements.rows.map((row) => mapMovement(row, id));

  return account;
}

async function create(userId, payload) {
  const { rows } = await pool.query(
    `
      INSERT INTO contas (usuario_id, nome, tipo, instituicao, saldo_inicial, saldo_atual, cor, icone, observacao)
      VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8)
      RETURNING id
    `,
    [
      userId,
      payload.name,
      payload.type || "corrente",
      payload.institution || null,
      payload.balance || 0,
      payload.color || null,
      payload.icon || null,
      payload.notes || null,
    ]
  );

  return rows[0];
}

async function update(userId, id, payload) {
  const { rows } = await pool.query(
    `
      UPDATE contas
      SET
        nome = COALESCE($3, nome),
        tipo = COALESCE($4, tipo),
        instituicao = COALESCE($5, instituicao),
        saldo_atual = COALESCE($6, saldo_atual),
        cor = COALESCE($7, cor),
        icone = COALESCE($8, icone),
        observacao = COALESCE($9, observacao),
        updated_at = now()
      WHERE usuario_id = $1 AND id = $2
      RETURNING id
    `,
    [
      userId,
      id,
      payload.name,
      payload.type,
      payload.institution,
      payload.balance,
      payload.color,
      payload.icon,
      payload.notes,
    ]
  );

  return rows[0] || null;
}

async function remove(userId, id) {
  const { rowCount } = await pool.query("DELETE FROM contas WHERE usuario_id = $1 AND id = $2", [userId, id]);
  return rowCount > 0;
}

module.exports = { findAll, findSummary, findById, create, update, remove, mapAccountSummary };
