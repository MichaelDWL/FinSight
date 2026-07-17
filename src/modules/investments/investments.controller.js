const asyncHandler = require("../../utils/asyncHandler");
const { getCurrentUserId } = require("../../utils/demoUser");
const { success } = require("../../utils/apiResponse");
const service = require("./investments.service");

const list = asyncHandler(async (req, res) => {
  const data = await service.list(getCurrentUserId(req));
  return success(res, { message: "Investimentos carregados.", data });
});

const listDetailed = asyncHandler(async (req, res) => {
  const data = await service.listDetailed(getCurrentUserId(req), {
    pagination: req.pagination,
  });
  return success(res, { message: "Investimentos detalhados carregados.", data });
});

const detail = asyncHandler(async (req, res) => {
  const data = await service.detail(getCurrentUserId(req), req.params.id);
  return success(res, { message: "Investimento carregado.", data });
});

const create = asyncHandler(async (req, res) => {
  const data = await service.create(getCurrentUserId(req), req.validated.body);
  return success(res, { statusCode: 201, message: "Investimento cadastrado com sucesso.", data });
});

const update = asyncHandler(async (req, res) => {
  const data = await service.update(getCurrentUserId(req), req.params.id, req.validated.body);
  return success(res, { message: "Investimento atualizado com sucesso.", data });
});

const remove = asyncHandler(async (req, res) => {
  const data = await service.remove(getCurrentUserId(req), req.params.id);
  return success(res, { message: "Investimento excluido com sucesso.", data });
});

const simulate = asyncHandler(async (req, res) => {
  const data = await service.simulate(req.validated.body);
  return success(res, { message: "Simulacao gerada.", data });
});

const portfolio = asyncHandler(async (req, res) => {
  const data = await service.portfolioSummary(getCurrentUserId(req));
  return success(res, { message: "Resumo da carteira carregado.", data });
});

module.exports = { create, detail, list, listDetailed, portfolio, remove, simulate, update };
