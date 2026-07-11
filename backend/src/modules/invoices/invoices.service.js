const pool = require("../../database/pool");
const AppError = require("../../utils/AppError");
const { withTransaction } = require("../../database/transaction");
const invoiceService = require("../../services/invoiceService");

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
  return result;
}

module.exports = { listByCard, listItems, pay };
