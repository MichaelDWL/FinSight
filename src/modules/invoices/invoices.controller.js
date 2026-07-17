const asyncHandler = require("../../utils/asyncHandler");
const { getCurrentUserId } = require("../../utils/demoUser");
const { success } = require("../../utils/apiResponse");
const service = require("./invoices.service");

const listByCard = asyncHandler(async (req, res) => {
  const data = await service.listByCard(getCurrentUserId(req), req.params.cardId);
  return success(res, { message: "Faturas carregadas.", data });
});

const listCurrent = asyncHandler(async (req, res) => {
  const data = await service.listCurrent(getCurrentUserId(req));
  return success(res, { message: "Faturas do mes carregadas.", data });
});

const listItems = asyncHandler(async (req, res) => {
  const data = await service.listItems(getCurrentUserId(req), req.params.id);
  return success(res, { message: "Compras da fatura carregadas.", data });
});

const pay = asyncHandler(async (req, res) => {
  const data = await service.pay(getCurrentUserId(req), req.params.id);
  return success(res, { message: "Fatura paga com sucesso.", data });
});

module.exports = { listByCard, listCurrent, listItems, pay };
