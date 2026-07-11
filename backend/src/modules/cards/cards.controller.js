const asyncHandler = require("../../utils/asyncHandler");
const { getCurrentUserId } = require("../../utils/demoUser");
const { success } = require("../../utils/apiResponse");
const service = require("./cards.service");

const list = asyncHandler(async (req, res) => {
  const data = await service.list(getCurrentUserId(req));
  return success(res, { message: "Cartoes carregados.", data });
});

const detail = asyncHandler(async (req, res) => {
  const data = await service.detail(getCurrentUserId(req), req.params.id);
  return success(res, { message: "Detalhes do cartao carregados.", data });
});

const create = asyncHandler(async (req, res) => {
  const data = await service.create(getCurrentUserId(req), req.validated.body);
  return success(res, { statusCode: 201, message: "Cartao cadastrado com seguranca.", data });
});

const update = asyncHandler(async (req, res) => {
  const data = await service.update(getCurrentUserId(req), req.params.id, req.validated.body);
  return success(res, { message: "Cartao atualizado com sucesso.", data });
});

const remove = asyncHandler(async (req, res) => {
  const data = await service.remove(getCurrentUserId(req), req.params.id);
  return success(res, { message: "Cartao excluido com sucesso.", data });
});

module.exports = { create, detail, list, remove, update };
