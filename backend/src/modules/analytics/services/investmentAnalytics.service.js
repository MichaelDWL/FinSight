const rateService = require("../../market-data/rate.service");
const projectionService = require("../../investments/projection.service");
const investmentsRepository = require("../../investments/investments.repository");

async function consolidatePortfolioAnalytics(userId) {
  const [investments, rates] = await Promise.all([
    investmentsRepository.findAll(userId),
    rateService.getCurrentRates(),
  ]);

  const invested = investments.reduce((sum, item) => sum + item.invested, 0);
  const current = investments.reduce((sum, item) => sum + item.value, 0);
  const profit = current - invested;

  const byType = {};
  investments.forEach((item) => {
    const key = item.investmentType || item.type || "outro";
    if (!byType[key]) {
      byType[key] = { type: key, invested: 0, value: 0, count: 0 };
    }
    byType[key].invested += item.invested;
    byType[key].value += item.value;
    byType[key].count += 1;
  });

  const returnByType = Object.values(byType).map((item) => ({
    ...item,
    invested: Number(item.invested.toFixed(2)),
    value: Number(item.value.toFixed(2)),
    profit: Number((item.value - item.invested).toFixed(2)),
    returnRate:
      item.invested > 0
        ? Number((((item.value - item.invested) / item.invested) * 100).toFixed(2))
        : 0,
  }));

  const sortedByValue = [...investments].sort((a, b) => b.value - a.value);
  const sortedByProfit = [...investments].sort((a, b) => b.profit - a.profit);

  return {
    economicRates: {
      selic: rates?.selic ?? null,
      cdi: rates?.cdi ?? null,
      ipca: rates?.ipca ?? null,
      dolar: rates?.dolar ?? null,
      euro: rates?.euro ?? null,
      lastUpdate: rates?.lastUpdate ?? null,
      stale: rates?.stale ?? true,
    },
    portfolio: {
      invested: Number(invested.toFixed(2)),
      current: Number(current.toFixed(2)),
      profit: Number(profit.toFixed(2)),
      returnRate: invested > 0 ? Number(((profit / invested) * 100).toFixed(2)) : 0,
      returnByType,
      largestPosition: sortedByValue[0] || null,
      bestProfit: sortedByProfit[0] || null,
      worstProfit: sortedByProfit[sortedByProfit.length - 1] || null,
    },
    portfolioProjection: projectionService.projectPortfolio(investments, rates),
  };
}

module.exports = { consolidatePortfolioAnalytics };
