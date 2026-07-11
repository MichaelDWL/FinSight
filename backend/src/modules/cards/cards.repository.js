const pool = require("../../database/pool");

function mapCard(row) {
  const usedLimit = Number(row.limite_total) - Number(row.limite_disponivel);

  return {
    id: row.id,
    icon: "fa-credit-card",
    name: row.nome,
    bank: row.conta_pagamento || row.nome,
    brand: row.bandeira,
    lastDigits: String(row.id).replaceAll("-", "").slice(-3),
    color: row.cor || "#0d6efd",
    closingDay: Number(row.dia_fechamento),
    dueDay: Number(row.dia_vencimento),
    totalLimit: Number(row.limite_total),
    usedLimit,
    invoiceCurrent: Number(row.fatura_atual || 0),
    nextInvoice: Number(row.proxima_fatura || 0),
    notes: "",
    purchases: row.purchases || [],
  };
}

async function findAll(userId) {
  const { rows } = await pool.query(
    `
      SELECT
        c.*,
        co.nome AS conta_pagamento,
        COALESCE(SUM(f.valor_total) FILTER (WHERE f.status IN ('aberta', 'fechada', 'atrasada')), 0) AS fatura_atual,
        COALESCE(SUM(f.valor_total) FILTER (WHERE f.data_vencimento > CURRENT_DATE), 0) AS proxima_fatura
      FROM cartoes c
      LEFT JOIN contas co ON co.id = c.conta_pagamento_id
      LEFT JOIN faturas f ON f.cartao_id = c.id
      WHERE c.usuario_id = $1
      GROUP BY c.id, co.nome
      ORDER BY c.created_at ASC
    `,
    [userId]
  );

  return rows.map(mapCard);
}

async function findById(userId, id) {
  const { rows } = await pool.query(
    `
      SELECT
        c.*,
        co.nome AS conta_pagamento,
        COALESCE(SUM(f.valor_total) FILTER (WHERE f.status IN ('aberta', 'fechada', 'atrasada')), 0) AS fatura_atual,
        COALESCE(SUM(f.valor_total) FILTER (WHERE f.data_vencimento > CURRENT_DATE), 0) AS proxima_fatura
      FROM cartoes c
      LEFT JOIN contas co ON co.id = c.conta_pagamento_id
      LEFT JOIN faturas f ON f.cartao_id = c.id
      WHERE c.usuario_id = $1 AND c.id = $2
      GROUP BY c.id, co.nome
    `,
    [userId, id]
  );

  if (!rows[0]) return null;
  const card = mapCard(rows[0]);
  const purchases = await pool.query(
    `
      SELECT descricao AS name, valor, data_transacao AS date, COALESCE(cat.nome, 'Cartao') AS category
      FROM transacoes t
      LEFT JOIN categorias cat ON cat.id = t.categoria_id
      WHERE t.usuario_id = $1 AND t.cartao_id = $2
      ORDER BY t.data_transacao DESC
    `,
    [userId, id]
  );

  card.purchases = purchases.rows.map((row) => ({
    name: row.name,
    category: row.category,
    value: Number(row.valor),
    date: row.date,
  }));

  return card;
}

async function create(userId, payload) {
  const { rows } = await pool.query(
    `
      INSERT INTO cartoes (
        usuario_id, nome, bandeira, limite_total, limite_disponivel,
        dia_fechamento, dia_vencimento, cor
      )
      VALUES ($1, $2, $3, $4, $4, $5, $6, $7)
      RETURNING id
    `,
    [userId, payload.name, payload.brand || "Cartao", payload.totalLimit, payload.closingDay, payload.dueDay, payload.color || "#0d6efd"]
  );

  return rows[0];
}

async function update(userId, id, payload) {
  const { rows } = await pool.query(
    `
      UPDATE cartoes
      SET
        nome = COALESCE($3, nome),
        bandeira = COALESCE($4, bandeira),
        limite_total = COALESCE($5, limite_total),
        limite_disponivel = COALESCE($6, limite_disponivel),
        dia_fechamento = COALESCE($7, dia_fechamento),
        dia_vencimento = COALESCE($8, dia_vencimento),
        cor = COALESCE($9, cor),
        updated_at = now()
      WHERE usuario_id = $1 AND id = $2
      RETURNING id
    `,
    [userId, id, payload.name, payload.brand, payload.totalLimit, payload.availableLimit, payload.closingDay, payload.dueDay, payload.color]
  );

  return rows[0] || null;
}

async function remove(userId, id) {
  const { rowCount } = await pool.query("DELETE FROM cartoes WHERE usuario_id = $1 AND id = $2", [userId, id]);
  return rowCount > 0;
}

module.exports = { create, findAll, findById, remove, update };
