const AppError = require("../../utils/AppError");
const { invalidateUserAnalytics } = require("../analytics/analytics.invalidation");
const repository = require("./movements.repository");

function bustAnalyticsCache(userId) {
  invalidateUserAnalytics(userId).catch(() => undefined);
}

async function list(userId) {
  return repository.listAll(userId);
}

async function listTransactions(userId) {
  return repository.listTransactionsView(userId);
}

async function listBills(userId) {
  return repository.listBillsView(userId);
}

async function create(userId, payload) {
  const result = await repository.create(userId, payload);
  bustAnalyticsCache(userId);
  return result;
}

async function update(userId, id, payload) {
  const updated = await repository.update(userId, id, payload);
  if (!updated) throw new AppError("Movimentacao nao encontrada.", 404);
  bustAnalyticsCache(userId);
  return updated;
}

async function markPaid(userId, id, paid) {
  const updated = await repository.markPaid(userId, id, paid);
  if (!updated) throw new AppError("Movimentacao nao encontrada.", 404);
  bustAnalyticsCache(userId);
  return updated;
}

async function remove(userId, id) {
  const removed = await repository.remove(userId, id);
  if (!removed) throw new AppError("Movimentacao nao encontrada.", 404);
  bustAnalyticsCache(userId);
  return { id };
}

module.exports = { list, listTransactions, listBills, create, update, markPaid, remove };
