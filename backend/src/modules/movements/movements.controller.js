const asyncHandler = require("../../utils/asyncHandler");
const { getCurrentUserId } = require("../../utils/demoUser");
const { success } = require("../../utils/apiResponse");
const service = require("./movements.service");

const list = asyncHandler(async (req, res) => {
  const data = await service.list(getCurrentUserId(req));
  return success(res, { message: "Movimentacoes carregadas.", data });
});

const listTransactions = asyncHandler(async (req, res) => {
  const data = await service.listTransactions(getCurrentUserId(req));
  return success(res, { message: "Transacoes carregadas.", data });
});

const listBills = asyncHandler(async (req, res) => {
  const data = await service.listBills(getCurrentUserId(req));
  return success(res, { message: "Contas carregadas.", data });
});

const create = asyncHandler(async (req, res) => {
  const data = await service.create(getCurrentUserId(req), req.validated.body);
  return success(res, { statusCode: 201, message: "Movimentacao registrada com sucesso.", data });
});

const update = asyncHandler(async (req, res) => {
  const data = await service.update(getCurrentUserId(req), req.params.id, req.validated.body);
  return success(res, { message: "Movimentacao atualizada com sucesso.", data });
});

const markPaid = asyncHandler(async (req, res) => {
  const data = await service.markPaid(getCurrentUserId(req), req.params.id, req.validated.body.paid);
  return success(res, { message: "Status da movimentacao atualizado.", data });
});

const remove = asyncHandler(async (req, res) => {
  const data = await service.remove(getCurrentUserId(req), req.params.id);
  return success(res, { message: "Movimentacao excluida com sucesso.", data });
});

module.exports = { list, listTransactions, listBills, create, update, markPaid, remove };
