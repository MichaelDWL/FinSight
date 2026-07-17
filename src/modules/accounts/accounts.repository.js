const pool = require("../../database/pool");

const SETTLED = "('confirmada', 'paga')";
const OUTFLOW_TYPES = "('despesa', 'recorrencia', 'pagamento_fatura')";

// Subqueries reutilizadas para consolidar receitas/despesas do mes e a ultima
// movimentacao de cada conta. Espelham a regra do balanceService: transferencia
// entra na conta destino e sai da conta origem.
const RECEITAS_MES = `
  COALESCE((
    SELECT SUM(m.valor) FROM movimentacoes m
    WHERE m.usuario_id = c.usuario_id
      AND m.status IN ${SETTLED}
      AND date_trunc('month', m.data_transacao) = date_trunc('month', CURRENT_DATE)
      AND (
        (m.tipo = 'receita' AND m.conta_id = c.id)
        OR (m.tipo = 'transferencia' AND m.conta_destino_id = c.id)
      )
  ), 0) AS receitas_mes
`;

const DESPESAS_MES = `
  COALESCE((
    SELECT SUM(m.valor) FROM movimentacoes m
    WHERE m.usuario_id = c.usuario_id
      AND m.status IN ${SETTLED}
      AND date_trunc('month', m.data_transacao) = date_trunc('month', CURRENT_DATE)
      AND (
        (m.tipo IN ${OUTFLOW_TYPES} AND m.conta_id = c.id)
        OR (m.tipo = 'transferencia' AND m.conta_id = c.id)
      )
  ), 0) AS despesas_mes
`;

const ULTIMA_MOV = `
  (SELECT MAX(m.data_transacao) FROM movimentacoes m
    WHERE m.usuario_id = c.usuario_id
      AND (m.conta_id = c.id OR m.conta_destino_id = c.id)) AS ultima_movimentacao
`;

const TOTAL_MOV = `
  (SELECT COUNT(*) FROM movimentacoes m
    WHERE m.usuario_id = c.usuario_id
      AND (m.conta_id = c.id OR m.conta_destino_id = c.id)) AS total_movimentacoes
`;

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
      SELECT
        c.id, c.nome, c.tipo, c.instituicao, c.saldo_atual, c.cor, c.icone, c.observacao, c.status,
        ${RECEITAS_MES},
        ${DESPESAS_MES},
        ${ULTIMA_MOV},
        ${TOTAL_MOV}
      FROM contas c
      WHERE c.usuario_id = $1
      ORDER BY c.created_at ASC
    `,
    [userId]
  );

  return rows.map(mapAccount);
}

async function findById(userId, id) {
  const { rows } = await pool.query(
    `
      SELECT
        c.id, c.nome, c.tipo, c.instituicao, c.saldo_atual, c.cor, c.icone, c.observacao, c.status,
        ${RECEITAS_MES},
        ${DESPESAS_MES},
        ${ULTIMA_MOV},
        ${TOTAL_MOV}
      FROM contas c
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
      WHERE m.usuario_id = $1 AND (m.conta_id = $2 OR m.conta_destino_id = $2)
      ORDER BY m.data_transacao DESC, m.created_at DESC
    `,
    [userId, id]
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

module.exports = { findAll, findById, create, update, remove };
