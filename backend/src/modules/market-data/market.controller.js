const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const marketService = require("./market.service");
const rateService = require("./rate.service");

const overview = asyncHandler(async (_req, res) => {
  const data = await marketService.getOverview();
  return success(res, { message: "Visao geral de mercado carregada.", data });
});

const rates = asyncHandler(async (_req, res) => {
  const data = await rateService.getCurrentRates();
  return success(res, { message: "Indicadores economicos carregados.", data });
});

const ratesHistory = asyncHandler(async (req, res) => {
  const indicator = req.validated?.query?.indicator;
  const limit = req.validated?.query?.limit;
  const data = await rateService.getHistory(indicator, { limit });
  return success(res, { message: "Historico de indicadores carregado.", data });
});

const listAssets = asyncHandler(async (req, res) => {
  const assetType = req.validated?.query?.type;
  const data = await marketService.listAssets({ assetType });
  return success(res, { message: "Ativos de mercado carregados.", data });
});

const assetDetail = asyncHandler(async (req, res) => {
  const data = await marketService.getAsset(req.params.code);
  if (!data) throw new AppError("Ativo nao encontrado no banco de mercado.", 404);
  return success(res, { message: "Ativo de mercado carregado.", data });
});

const history = asyncHandler(async (req, res) => {
  const code = req.validated?.query?.code || req.validated?.query?.asset;
  const limit = req.validated?.query?.limit;
  if (!code) throw new AppError("Parametro code e obrigatorio.", 400);
  const data = await marketService.getHistory(code, { limit });
  return success(res, { message: "Historico de mercado carregado.", data });
});

const providersStatus = asyncHandler(async (req, res) => {
  const refresh = req.validated?.query?.refresh === true;
  const data = refresh
    ? await marketService.checkProvidersHealth()
    : await marketService.getProvidersStatus();
  return success(res, { message: "Status dos provedores de mercado.", data });
});

module.exports = {
  assetDetail,
  history,
  listAssets,
  overview,
  providersStatus,
  rates,
  ratesHistory,
};
