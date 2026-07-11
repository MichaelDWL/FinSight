const asyncHandler = require("../../utils/asyncHandler");
const { getCurrentUserId } = require("../../utils/demoUser");
const { success } = require("../../utils/apiResponse");
const service = require("./bills.service");

const list = asyncHandler(async (req, res) => {
  const data = await service.list(getCurrentUserId(req));
  return success(res, { message: "Contas a pagar carregadas.", data });
});

const create = asyncHandler(async (req, res) => {
  const data = await service.create(getCurrentUserId(req), req.validated.body);
  return success(res, { statusCode: 201, message: "Conta cadastrada com sucesso.", data });
});

const update = asyncHandler(async (req, res) => {
  const data = await service.update(getCurrentUserId(req), req.params.id, req.validated.body);
  return success(res, { message: "Conta atualizada com sucesso.", data });
});

const markPaid = asyncHandler(async (req, res) => {
  const data = await service.markPaid(getCurrentUserId(req), req.params.id, req.validated.body.paid);
  return success(res, { message: "Status da conta atualizado.", data });
});

const remove = asyncHandler(async (req, res) => {
  const data = await service.remove(getCurrentUserId(req), req.params.id);
  return success(res, { message: "Conta excluida com sucesso.", data });
});

module.exports = { create, list, markPaid, remove, update };
