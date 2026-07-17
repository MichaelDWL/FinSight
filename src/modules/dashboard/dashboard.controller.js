const asyncHandler = require("../../utils/asyncHandler");
const { getCurrentUserId } = require("../../utils/demoUser");
const { success } = require("../../utils/apiResponse");
const analyticsService = require("../analytics/analytics.service");
const service = require("./dashboard.service");

const show = asyncHandler(async (req, res) => {
  res.set("Deprecation", "true");
  res.set("Link", '</api/dashboard/general>; rel="successor-version"');

  const data = await service.getDashboard(getCurrentUserId(req));
  return success(res, {
    message: "Home carregada. Rota legada — use /api/dashboard/general.",
    data,
  });
});

const general = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const data = await analyticsService.getGeneral(getCurrentUserId(req), query);
  return success(res, { message: "Dashboard geral carregado.", data });
});

const expenses = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const data = await analyticsService.getExpenses(getCurrentUserId(req), query);
  return success(res, { message: "Dashboard de gastos carregado.", data });
});

const cashflow = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const data = await analyticsService.getCashflow(getCurrentUserId(req), query);
  return success(res, { message: "Dashboard de fluxo de caixa carregado.", data });
});

const cards = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const data = await analyticsService.getCards(getCurrentUserId(req), query);
  return success(res, { message: "Dashboard de cartoes carregado.", data });
});

const investments = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const data = await analyticsService.getInvestments(getCurrentUserId(req), query);
  return success(res, { message: "Dashboard de investimentos carregado.", data });
});

module.exports = { show, general, expenses, cashflow, cards, investments };
