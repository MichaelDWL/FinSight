const pool = require("../../database/pool");

function mapTransaction(row) {
  return {
    id: row.id,
    icon: row.icon || "wallet",
    description: row.descricao,
    category: row.categoria || row.tipo,
    account: row.conta || "Sem conta",
    value: Number(row.valor),
    date: row.data_transacao,
    type: row.tipo === "receita" ? "Receita" : "Despesa",
    status: row.status,
    payment: row.forma_pagamento,
  };
}

async function findAll(userId) {
  const { rows } = await pool.query(
    `
      SELECT
        t.id,
        t.descricao,
        t.tipo,
        t.forma_pagamento,
        t.status,
        CASE WHEN t.tipo = 'receita' THEN t.valor ELSE -t.valor END AS valor,
        t.data_transacao,
        c.nome AS categoria,
        c.icone AS icon,
        co.nome AS conta
      FROM transacoes t
      LEFT JOIN categorias c ON c.id = t.categoria_id
      LEFT JOIN contas co ON co.id = t.conta_id
      WHERE t.usuario_id = $1
      ORDER BY t.data_transacao DESC, t.created_at DESC
    `,
    [userId]
  );

  return rows.map(mapTransaction);
}

async function create(userId, payload) {
  const { rows } = await pool.query(
    `
      INSERT INTO transacoes (
        usuario_id, conta_id, tipo, forma_pagamento, status, descricao,
        valor, data_transacao, data_competencia, observacao
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, date_trunc('month', $8::date)::date, $9)
      RETURNING id
    `,
    [
      userId,
      payload.accountId || null,
      payload.type || "despesa",
      payload.payment || "pix",
      payload.status || "confirmada",
      payload.description,
      payload.value,
      payload.date,
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
        status = COALESCE($5, status),
        data_transacao = COALESCE($6, data_transacao),
        updated_at = now()
      WHERE usuario_id = $1 AND id = $2
      RETURNING id
    `,
    [userId, id, payload.description, payload.value, payload.status, payload.date]
  );

  return rows[0] || null;
}

async function remove(userId, id) {
  const { rowCount } = await pool.query("DELETE FROM transacoes WHERE usuario_id = $1 AND id = $2", [userId, id]);
  return rowCount > 0;
}

module.exports = { findAll, create, update, remove };
