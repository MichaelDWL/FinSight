const AppError = require("../../utils/AppError");
const { invalidateUserAnalytics } = require("../analytics/analytics.invalidation");
const personalization = require("../personalization");
const financialAudit = require("../audit/financialAudit.service");
const { paginationService } = require("../../services/pagination/pagination.service");
const repository = require("./movements.repository");

function bustCaches(userId, eventName = personalization.EVENTS.TRANSACTION_CREATED) {
  invalidateUserAnalytics(userId).catch(() => undefined);
  personalization.notifyMutation(userId, eventName).catch(() => undefined);
}

function auditMetaFromReq(req) {
  if (!req) return {};
  return { origin: "api", ...financialAudit.fromRequest(req) };
}

function normalizeListOptions(options = {}) {
  if (options.pagination) {
    return {
      pagination: options.pagination,
      filters: options.filters || {},
    };
  }
  return {
    pagination: paginationService.parseFromQuery(
      {
        page: options.page,
        pageSize: options.pageSize,
        sort: options.sort,
        order: options.order,
      },
      { resource: "movements", defaultSort: "date" }
    ),
    filters: options.filters || {},
  };
}

async function list(userId, options = {}) {
  const result = await repository.listAll(userId, normalizeListOptions(options));
  return options.asArray === true ? result.items : result;
}

async function listTransactions(userId, options = {}) {
  const result = await repository.listTransactionsView(
    userId,
    normalizeListOptions(options)
  );
  return options.asArray === true ? result.items : result;
}

async function listBills(userId, options = {}) {
  const result = await repository.listBillsView(userId, normalizeListOptions(options));
  return options.asArray === true ? result.items : result;
}

async function create(userId, payload, req) {
  const result = await repository.create(userId, payload, auditMetaFromReq(req));
  bustCaches(userId, personalization.EVENTS.TRANSACTION_CREATED);
  return result;
}

async function update(userId, id, payload, req) {
  const updated = await repository.update(userId, id, payload, auditMetaFromReq(req));
  if (!updated) throw new AppError("Movimentacao nao encontrada.", 404);
  bustCaches(userId, personalization.EVENTS.TRANSACTION_UPDATED);
  return updated;
}

async function markPaid(userId, id, paid, req) {
  const updated = await repository.markPaid(userId, id, paid, auditMetaFromReq(req));
  if (!updated) throw new AppError("Movimentacao nao encontrada.", 404);
  bustCaches(userId, personalization.EVENTS.BILL_PAID);
  return updated;
}

async function remove(userId, id, req) {
  const removed = await repository.remove(userId, id, auditMetaFromReq(req));
  if (!removed) throw new AppError("Movimentacao nao encontrada.", 404);
  bustCaches(userId, personalization.EVENTS.TRANSACTION_UPDATED);
  return { id };
}

module.exports = { list, listTransactions, listBills, create, update, markPaid, remove };
