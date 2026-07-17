const AppError = require("../../utils/AppError");
const { invalidateUserAnalytics } = require("../analytics/analytics.invalidation");
const { notifyMutation, EVENTS } = require("../personalization");
const rateService = require("../market-data/rate.service");
const marketService = require("../market-data/market.service");
const { PROJECTION_DISCLAIMER } = require("../market-data/market.constants");
const repository = require("./investments.repository");
const { detectInvestmentType, resolveCategoryName } = require("./investmentType.detector");
const projectionService = require("./projection.service");

function bustCaches(userId, eventName = EVENTS.INVESTMENT_ADDED) {
  invalidateUserAnalytics(userId).catch(() => undefined);
  notifyMutation(userId, eventName).catch(() => undefined);
}

async function resolveTypeAndCategory(payload) {
  const categoryName = payload.categoryId
    ? await repository.getCategoryNameById(payload.categoryId)
    : null;

  const investmentType =
    payload.investmentType ||
    detectInvestmentType({
      name: payload.name,
      categoryName,
      assetCode: payload.assetCode,
    });

  let categoryId = payload.categoryId;
  if (!categoryId) {
    const mappedName = resolveCategoryName(investmentType);
    categoryId =
      (await repository.getCategoryIdByName(mappedName)) ||
      (await repository.getDefaultCategoryId());
  }

  return { investmentType, categoryId };
}

async function attachProjection(investment) {
  const rates = await rateService.getCurrentRates();

  if (projectionService.isFixedIncome(investment.investmentType)) {
    return {
      ...investment,
      simulation: projectionService.projectFixedIncome(investment, rates),
    };
  }

  if (projectionService.isVariableIncome(investment.investmentType) && investment.assetCode) {
    const marketAsset = await marketService.getAsset(investment.assetCode);
    return {
      ...investment,
      simulation: projectionService.buildVariableIncomeView(investment, marketAsset),
    };
  }

  return {
    ...investment,
    simulation: null,
  };
}

async function list(userId) {
  return repository.findAll(userId);
}

async function listDetailed(userId) {
  const [items, rates] = await Promise.all([
    repository.findAll(userId),
    rateService.getCurrentRates(),
  ]);

  const marketCache = new Map();

  const detailed = [];
  for (const item of items) {
    const investmentType =
      item.investmentType ||
      detectInvestmentType({
        name: item.name,
        categoryName: item.type,
        assetCode: item.assetCode,
      });

    const enriched = { ...item, investmentType };

    if (projectionService.isFixedIncome(investmentType)) {
      detailed.push({
        ...enriched,
        simulation: projectionService.projectFixedIncome(enriched, rates),
      });
      continue;
    }

    if (projectionService.isVariableIncome(investmentType) && item.assetCode) {
      const code = String(item.assetCode).toUpperCase();
      if (!marketCache.has(code)) {
        // eslint-disable-next-line no-await-in-loop
        marketCache.set(code, await marketService.getAsset(code));
      }
      detailed.push({
        ...enriched,
        simulation: projectionService.buildVariableIncomeView(
          enriched,
          marketCache.get(code)
        ),
      });
      continue;
    }

    // RV sem asset_code: ainda monta a view sem mercado
    if (projectionService.isVariableIncome(investmentType)) {
      detailed.push({
        ...enriched,
        simulation: projectionService.buildVariableIncomeView(enriched, null),
      });
      continue;
    }

    detailed.push({ ...enriched, simulation: null });
  }

  return detailed;
}

async function detail(userId, id) {
  const investment = await repository.findById(userId, id);
  if (!investment) throw new AppError("Investimento nao encontrado.", 404);
  return attachProjection(investment);
}

async function create(userId, payload) {
  const { investmentType, categoryId } = await resolveTypeAndCategory(payload);

  let value = payload.value || payload.invested;
  if (payload.assetCode) {
    const typeHint =
      investmentType === "criptomoedas"
        ? "crypto"
        : investmentType === "fiis"
          ? "fii"
          : investmentType === "etfs"
            ? "etf"
            : "stock";

    const market = await marketService.ensureAssetInWatchlist(payload.assetCode, {
      assetType: typeHint,
      assetName: payload.name,
    });

    if (payload.quantity && market?.currentPrice) {
      value = Number((payload.quantity * market.currentPrice).toFixed(2));
    }
  }

  const created = await repository.create(userId, {
    ...payload,
    investmentType,
    categoryId,
    value,
  });

  bustCaches(userId);
  return attachProjection(created);
}

async function update(userId, id, payload) {
  const existing = await repository.findById(userId, id);
  if (!existing) throw new AppError("Investimento nao encontrado.", 404);

  const merged = {
    name: payload.name ?? existing.name,
    categoryId: payload.categoryId ?? existing.categoryId,
    assetCode: payload.assetCode ?? existing.assetCode,
    investmentType: payload.investmentType,
  };

  const { investmentType, categoryId } = await resolveTypeAndCategory(merged);

  let value = payload.value;
  const quantity = payload.quantity ?? existing.quantity;
  const assetCode = payload.assetCode ?? existing.assetCode;
  if (assetCode && quantity && value == null) {
    const market = await marketService.ensureAssetInWatchlist(assetCode);
    if (market?.currentPrice) {
      value = Number((quantity * market.currentPrice).toFixed(2));
    }
  }

  const updated = await repository.update(userId, id, {
    ...payload,
    investmentType,
    categoryId,
    value,
  });

  bustCaches(userId);
  return attachProjection(updated);
}

async function remove(userId, id) {
  const removed = await repository.remove(userId, id);
  if (!removed) throw new AppError("Investimento nao encontrado.", 404);
  bustCaches(userId);
  return { id };
}

async function simulate(payload) {
  const rates = await rateService.getCurrentRates();
  if (!projectionService.isFixedIncome(payload.investmentType)) {
    return {
      kind: "variable_income",
      forecast: null,
      message: "Simulacao de rendimento futuro disponivel apenas para renda fixa.",
      disclaimer: PROJECTION_DISCLAIMER,
    };
  }
  return projectionService.projectFixedIncome(payload, rates);
}

async function portfolioSummary(userId) {
  const [investments, rates] = await Promise.all([
    repository.findAll(userId),
    rateService.getCurrentRates(),
  ]);

  const invested = investments.reduce((sum, item) => sum + item.invested, 0);
  const current = investments.reduce((sum, item) => sum + item.value, 0);
  const profit = current - invested;

  const byCategory = {};
  const byAsset = investments.map((item) => ({
    id: item.id,
    name: item.name,
    investmentType: item.investmentType,
    invested: item.invested,
    value: item.value,
    profit: item.profit,
    returnRate: item.returnRate,
  }));

  investments.forEach((item) => {
    const key = item.type || "Outros";
    if (!byCategory[key]) {
      byCategory[key] = { category: key, invested: 0, value: 0, count: 0 };
    }
    byCategory[key].invested += item.invested;
    byCategory[key].value += item.value;
    byCategory[key].count += 1;
  });

  const distribution = Object.values(byCategory).map((item) => ({
    ...item,
    profit: Number((item.value - item.invested).toFixed(2)),
    returnRate:
      item.invested > 0
        ? Number((((item.value - item.invested) / item.invested) * 100).toFixed(2))
        : 0,
    percent: current > 0 ? Number(((item.value / current) * 100).toFixed(2)) : 0,
  }));

  const sortedByValue = [...investments].sort((a, b) => b.value - a.value);
  const sortedByProfit = [...investments].sort((a, b) => b.profit - a.profit);

  return {
    kpis: {
      invested: Number(invested.toFixed(2)),
      current: Number(current.toFixed(2)),
      profit: Number(profit.toFixed(2)),
      returnRate: invested > 0 ? Number(((profit / invested) * 100).toFixed(2)) : 0,
      count: investments.length,
    },
    distribution,
    byAsset,
    highlights: {
      largestPosition: sortedByValue[0] || null,
      bestProfit: sortedByProfit[0] || null,
      worstProfit: sortedByProfit[sortedByProfit.length - 1] || null,
    },
    portfolioProjection: projectionService.projectPortfolio(investments, rates),
    rates: {
      selic: rates?.selic ?? null,
      cdi: rates?.cdi ?? null,
      ipca: rates?.ipca ?? null,
      dolar: rates?.dolar ?? null,
      euro: rates?.euro ?? null,
      lastUpdate: rates?.lastUpdate ?? null,
    },
  };
}

module.exports = {
  create,
  detail,
  list,
  listDetailed,
  portfolioSummary,
  remove,
  simulate,
  update,
};
