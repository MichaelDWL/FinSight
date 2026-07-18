const pool = require("../../database/pool");
const invoiceService = require("../../services/invoice.service");

function normalizeLastDigits(value, fallbackId) {
  const raw = value || String(fallbackId || "").replaceAll("-", "").slice(-3);
  const digits = String(raw).replace(/\D/g, "").slice(-3);
  return digits.padStart(3, "0");
}

function mapCard(row) {
  const usedLimit = Number(row.limite_total) - Number(row.limite_disponivel);

  return {
    id: row.id,
    icon: "fa-credit-card",
    name: row.nome,
    bank: row.banco || row.conta_pagamento || row.nome,
    brand: row.bandeira,
    lastDigits: normalizeLastDigits(row.ultimos_digitos, row.id),
    color: row.cor || "#0d6efd",
    closingDay: Number(row.dia_fechamento),
    dueDay: Number(row.dia_vencimento),
    totalLimit: Number(row.limite_total),
    usedLimit,
    invoiceCurrent: Number(row.fatura_atual || 0),
    nextInvoice: Number(row.proxima_fatura || 0),
    notes: row.observacao || "",
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
      FROM movimentacoes t
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

  const invoices = await invoiceService.listByCard(pool, userId, id);
  card.invoices = invoices.map((row) => ({
    id: row.id,
    referenceMonth: row.mes_referencia,
    dueDate: row.data_vencimento,
    total: Number(row.valor_total),
    paid: Number(row.valor_pago),
    status: row.status,
  }));

  return card;
}

async function create(userId, payload) {
  const { rows } = await pool.query(
    `
      INSERT INTO cartoes (
        usuario_id, nome, bandeira, limite_total, limite_disponivel,
        dia_fechamento, dia_vencimento, cor, banco, ultimos_digitos, observacao
      )
      VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `,
    [
      userId,
      payload.name,
      payload.brand || "Cartao",
      payload.totalLimit,
      payload.closingDay,
      payload.dueDay,
      payload.color || "#0d6efd",
      payload.bank || null,
      normalizeLastDigits(payload.lastDigits),
      payload.notes || null,
    ]
  );

  return rows[0];
}

async function update(userId, id, payload) {
  const currentResult = await pool.query(
    `
      SELECT limite_total, limite_disponivel
      FROM cartoes
      WHERE usuario_id = $1 AND id = $2
    `,
    [userId, id]
  );

  if (!currentResult.rows[0]) return null;

  const currentTotal = Number(currentResult.rows[0].limite_total);
  const currentAvailable = Number(currentResult.rows[0].limite_disponivel);
  const usedLimit = Math.max(currentTotal - currentAvailable, 0);
  const nextTotal = payload.totalLimit ?? currentTotal;
  let nextAvailable = payload.availableLimit;

  if (nextAvailable === undefined) {
    nextAvailable =
      payload.totalLimit !== undefined
        ? Math.max(nextTotal - usedLimit, 0)
        : currentAvailable;
  }

  nextAvailable = Math.min(Math.max(nextAvailable, 0), nextTotal);

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
        banco = COALESCE($10, banco),
        ultimos_digitos = COALESCE($11, ultimos_digitos),
        observacao = COALESCE($12, observacao),
        updated_at = now()
      WHERE usuario_id = $1 AND id = $2
      RETURNING id
    `,
    [
      userId,
      id,
      payload.name,
      payload.brand,
      payload.totalLimit,
      nextAvailable,
      payload.closingDay,
      payload.dueDay,
      payload.color,
      payload.bank,
      payload.lastDigits ? normalizeLastDigits(payload.lastDigits) : null,
      payload.notes,
    ]
  );

  return rows[0] || null;
}

async function remove(userId, id) {
  const { rowCount } = await pool.query("DELETE FROM cartoes WHERE usuario_id = $1 AND id = $2", [userId, id]);
  return rowCount > 0;
}

module.exports = { create, findAll, findById, remove, update };
