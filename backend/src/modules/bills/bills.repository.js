const pool = require("../../database/pool");

function mapBill(row) {
  return {
    id: row.id,
    icon: row.icone || "fa-file-invoice-dollar",
    name: row.descricao,
    category: row.categoria || "Conta",
    value: Number(row.valor),
    dueDate: row.data_transacao,
    status: row.status === "paga" ? "paid" : "pending",
    paymentMethod: row.forma_pagamento,
    recurrence: Boolean(row.recorrente),
  };
}

async function findAll(userId) {
  const { rows } = await pool.query(
    `
      SELECT t.*, c.nome AS categoria, c.icone
      FROM transacoes t
      LEFT JOIN categorias c ON c.id = t.categoria_id
      WHERE t.usuario_id = $1
        AND t.tipo IN ('despesa', 'recorrencia', 'pagamento_fatura')
      ORDER BY t.data_transacao ASC, t.created_at DESC
    `,
    [userId]
  );

  return rows.map(mapBill);
}

async function create(userId, payload) {
  const { rows } = await pool.query(
    `
      INSERT INTO transacoes (
        usuario_id, tipo, forma_pagamento, status, descricao, valor,
        data_transacao, data_competencia, recorrente, recorrencia_intervalo, observacao
      )
      VALUES (
        $1, $2, $3, 'pendente', $4, $5,
        $6, date_trunc('month', $6::date)::date, $7, $8, $9
      )
      RETURNING id
    `,
    [
      userId,
      payload.recurrence ? "recorrencia" : "despesa",
      payload.paymentMethod || "boleto",
      payload.name,
      payload.value,
      payload.dueDate,
      Boolean(payload.recurrence),
      payload.recurrence ? "mensal" : null,
      payload.notes || null,
    ]
  );

  return rows[0];
}

async function update(userId, id, payload) {
  const { rows } = await pool.query(
    `
      UPDATE transacoes
      SET
        descricao = COALESCE($3, descricao),
        valor = COALESCE($4, valor),
        data_transacao = COALESCE($5, data_transacao),
        data_competencia = COALESCE(date_trunc('month', $5::date)::date, data_competencia),
        forma_pagamento = COALESCE($6, forma_pagamento),
        status = COALESCE($7, status),
        recorrente = COALESCE($8, recorrente),
        recorrencia_intervalo = CASE
          WHEN COALESCE($8, recorrente) THEN 'mensal'
          ELSE NULL
        END,
        observacao = COALESCE($9, observacao),
        updated_at = now()
      WHERE usuario_id = $1 AND id = $2
      RETURNING id
    `,
    [userId, id, payload.name, payload.value, payload.dueDate, payload.paymentMethod, payload.status, payload.recurrence, payload.notes]
  );

  return rows[0] || null;
}

async function markPaid(userId, id, paid) {
  const { rows } = await pool.query(
    `
      UPDATE transacoes
      SET status = $3, updated_at = now()
      WHERE usuario_id = $1 AND id = $2
      RETURNING id
    `,
    [userId, id, paid ? "paga" : "pendente"]
  );

  return rows[0] || null;
}

async function remove(userId, id) {
  const { rowCount } = await pool.query("DELETE FROM transacoes WHERE usuario_id = $1 AND id = $2", [userId, id]);
  return rowCount > 0;
}

module.exports = { create, findAll, markPaid, remove, update };
