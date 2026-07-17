// Servico de dominio das faturas de cartao. Concentra o calculo de datas,
// a criacao automatica de faturas, o rateio em parcelas e o pagamento.
// Reutilizado pelo modulo de movimentacoes e pelo modulo de faturas.

const { applyMovement } = require("./balanceService");

function firstOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

// Garante que o dia exista no mes (ex.: dia 31 em fevereiro -> ultimo dia).
function clampDay(year, monthIndex, day) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(day, lastDay);
}

function toIso(date) {
  return date.toISOString().slice(0, 10);
}

// Descobre o mes de referencia da fatura para uma compra:
// se a compra ocorre ate o fechamento, entra na fatura do mes corrente;
// depois do fechamento, entra na fatura do mes seguinte.
function referenceMonthForPurchase(dateStr, closingDay) {
  const [year, month, day] = String(dateStr).slice(0, 10).split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, 1));
  return day <= closingDay ? base : addMonths(base, 1);
}

function computeInvoiceDates(refMonth, closingDay, dueDay) {
  const year = refMonth.getUTCFullYear();
  const monthIndex = refMonth.getUTCMonth();

  const fechamento = new Date(Date.UTC(year, monthIndex, clampDay(year, monthIndex, closingDay)));

  // Vencimento cai no mesmo mes quando o dia do vencimento e posterior ao
  // fechamento; caso contrario, no mes seguinte (respeita data_vencimento >= data_fechamento).
  const dueBase = dueDay > closingDay ? refMonth : addMonths(refMonth, 1);
  const dueYear = dueBase.getUTCFullYear();
  const dueMonthIndex = dueBase.getUTCMonth();
  const vencimento = new Date(Date.UTC(dueYear, dueMonthIndex, clampDay(dueYear, dueMonthIndex, dueDay)));

  return {
    mesReferencia: toIso(refMonth),
    dataFechamento: toIso(fechamento),
    dataVencimento: toIso(vencimento),
  };
}

// Cria a fatura do mes se ainda nao existir; devolve sempre a fatura vigente.
async function getOrCreateInvoice(client, userId, card, refMonth) {
  const { mesReferencia, dataFechamento, dataVencimento } = computeInvoiceDates(
    firstOfMonth(refMonth),
    Number(card.dia_fechamento),
    Number(card.dia_vencimento)
  );

  const { rows } = await client.query(
    `INSERT INTO faturas (usuario_id, cartao_id, mes_referencia, data_fechamento, data_vencimento)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (cartao_id, mes_referencia) DO UPDATE SET updated_at = now()
     RETURNING id, mes_referencia, data_vencimento, valor_total, valor_pago, status`,
    [userId, card.id, mesReferencia, dataFechamento, dataVencimento]
  );

  return rows[0];
}

async function addToInvoice(client, invoiceId, amount) {
  await client.query(
    `UPDATE faturas SET valor_total = valor_total + $2, updated_at = now() WHERE id = $1`,
    [invoiceId, amount]
  );
}

async function listByCard(client, userId, cardId) {
  const { rows } = await client.query(
    `SELECT id, mes_referencia, data_fechamento, data_vencimento, valor_total, valor_pago, status
       FROM faturas
      WHERE usuario_id = $1 AND cartao_id = $2
      ORDER BY mes_referencia DESC`,
    [userId, cardId]
  );
  return rows;
}

// Lista as compras vinculadas a uma fatura: cada parcela (compras parceladas)
// e cada compra a vista (movimentacao sem parcelas cujo fatura_id aponta aqui).
async function listItems(client, userId, invoiceId) {
  const { rows } = await client.query(
    `
      SELECT
        m.id AS movimentacao_id,
        m.descricao AS name,
        COALESCE(cat.nome, 'Cartao') AS category,
        m.data_transacao AS date,
        p.numero AS installment_number,
        p.total AS installments_total,
        p.valor AS value,
        p.status AS status
      FROM parcelas p
      JOIN movimentacoes m ON m.id = p.movimentacao_id
      LEFT JOIN categorias cat ON cat.id = m.categoria_id
      WHERE p.usuario_id = $1 AND p.fatura_id = $2

      UNION ALL

      SELECT
        m.id AS movimentacao_id,
        m.descricao AS name,
        COALESCE(cat.nome, 'Cartao') AS category,
        m.data_transacao AS date,
        1 AS installment_number,
        1 AS installments_total,
        m.valor AS value,
        m.status AS status
      FROM movimentacoes m
      LEFT JOIN categorias cat ON cat.id = m.categoria_id
      WHERE m.usuario_id = $1
        AND m.fatura_id = $2
        AND m.tipo <> 'pagamento_fatura'
        AND NOT EXISTS (SELECT 1 FROM parcelas pp WHERE pp.movimentacao_id = m.id)

      ORDER BY date DESC
    `,
    [userId, invoiceId]
  );
  return rows;
}

// Pagamento de fatura: quita todas as parcelas, fecha a fatura, restaura o
// limite do cartao e gera a movimentacao de pagamento (debita a conta padrao).
async function payInvoice(client, userId, invoiceId) {
  const { rows } = await client.query(
    `SELECT f.id, f.cartao_id, f.valor_total, c.conta_pagamento_id
       FROM faturas f
       JOIN cartoes c ON c.id = f.cartao_id
      WHERE f.usuario_id = $1 AND f.id = $2`,
    [userId, invoiceId]
  );
  const fatura = rows[0];
  if (!fatura) return null;

  await client.query(
    `UPDATE parcelas SET status = 'paga', data_pagamento = CURRENT_DATE, updated_at = now()
      WHERE fatura_id = $1 AND status <> 'paga'`,
    [invoiceId]
  );

  await client.query(
    `UPDATE faturas SET valor_pago = valor_total, status = 'paga', updated_at = now() WHERE id = $1`,
    [invoiceId]
  );

  await client.query(
    `UPDATE cartoes
        SET limite_disponivel = LEAST(limite_disponivel + $2, limite_total), updated_at = now()
      WHERE id = $1`,
    [fatura.cartao_id, fatura.valor_total]
  );

  if (Number(fatura.valor_total) > 0) {
    const { rows: mv } = await client.query(
      `INSERT INTO movimentacoes (
         usuario_id, conta_id, cartao_id, fatura_id, tipo, origem, forma_pagamento,
         status, descricao, valor, data_transacao, data_competencia
       )
       VALUES ($1, $2, $3, $4, 'pagamento_fatura', 'manual', 'transferencia',
               'paga', $5, $6, CURRENT_DATE, date_trunc('month', CURRENT_DATE)::date)
       RETURNING id, tipo, status, valor, conta_id, conta_destino_id`,
      [userId, fatura.conta_pagamento_id, fatura.cartao_id, invoiceId, "Pagamento de fatura", fatura.valor_total]
    );

    await applyMovement(client, mv[0], 1);
  }

  return { id: invoiceId };
}

module.exports = {
  firstOfMonth,
  addMonths,
  referenceMonthForPurchase,
  computeInvoiceDates,
  getOrCreateInvoice,
  addToInvoice,
  listByCard,
  listItems,
  payInvoice,
};
