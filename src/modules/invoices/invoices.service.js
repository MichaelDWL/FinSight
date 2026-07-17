const pool = require("../../database/pool");
const AppError = require("../../utils/AppError");
const { withTransaction } = require("../../database/transaction");
const invoiceService = require("../../services/invoiceService");
const { invalidateUserAnalytics } = require("../analytics/analytics.invalidation");

function mapInvoice(row) {
  return {
    id: row.id,
    referenceMonth: row.mes_referencia,
    closingDate: row.data_fechamento,
    dueDate: row.data_vencimento,
    total: Number(row.valor_total),
    paid: Number(row.valor_pago),
    status: row.status,
  };
}

async function listByCard(userId, cardId) {
  const rows = await invoiceService.listByCard(pool, userId, cardId);
  return rows.map(mapInvoice);
}

function mapItem(row) {
  return {
    movementId: row.movimentacao_id,
    name: row.name,
    category: row.category,
    date: row.date,
    installmentNumber: Number(row.installment_number),
    installmentsTotal: Number(row.installments_total),
    value: Number(row.value),
    status: row.status,
  };
}

async function listItems(userId, id) {
  const rows = await invoiceService.listItems(pool, userId, id);
  return rows.map(mapItem);
}

async function pay(userId, id) {
  const result = await withTransaction((client) => invoiceService.payInvoice(client, userId, id));
  if (!result) throw new AppError("Fatura nao encontrada.", 404);
  invalidateUserAnalytics(userId).catch(() => undefined);
  return result;
}

async function listCurrent(userId) {
  const { rows } = await pool.query(
    `
      SELECT
        c.id AS card_id,
        c.nome AS card_name,
        c.bandeira AS card_brand,
        c.cor AS card_color,
        c.ultimos_digitos AS last_digits,
        c.dia_vencimento AS due_day,
        f.id AS invoice_id,
        f.mes_referencia AS reference_month,
        f.data_vencimento AS due_date,
        f.valor_total AS total,
        f.valor_pago AS paid,
        f.status
      FROM cartoes c
      LEFT JOIN faturas f
        ON f.cartao_id = c.id
        AND f.mes_referencia = date_trunc('month', CURRENT_DATE)::date
      WHERE c.usuario_id = $1
      ORDER BY c.created_at ASC
    `,
    [userId],
  );

  return rows.map((row) => ({
    cardId: row.card_id,
    cardName: row.card_name,
    cardBrand: row.card_brand,
    cardColor: row.card_color || "#0d6efd",
    lastDigits: row.last_digits,
    dueDay: Number(row.due_day),
    invoice: row.invoice_id
      ? {
          id: row.invoice_id,
          referenceMonth: row.reference_month,
          dueDate: row.due_date,
          total: Number(row.total),
          paid: Number(row.paid),
          status: row.status,
        }
      : null,
  }));
}

module.exports = { listByCard, listItems, listCurrent, pay };
