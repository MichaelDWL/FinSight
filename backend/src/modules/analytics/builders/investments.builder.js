const { round2 } = require("../engines/financialHealth.engine");

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [];
}

function buildMonthlyReturns(evolution) {
  return evolution.map((item, index) => {
    if (index === 0) {
      return {
        month: item.month,
        monthStart: item.monthStart,
        returnRate: 0,
        patrimonio: item.patrimonio,
      };
    }

    const previous = Number(evolution[index - 1].patrimonio) || 0;
    const current = Number(item.patrimonio) || 0;
    const returnRate =
      previous > 0 ? round2(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;

    return {
      month: item.month,
      monthStart: item.monthStart,
      returnRate,
      patrimonio: current,
    };
  });
}

function buildBenchmarkComparison(monthlyReturns, benchmarks) {
  const months = [...new Set(monthlyReturns.map((item) => item.monthStart))];
  const indices = ["CDI", "SELIC", "IPCA"];

  return months.map((monthStart) => {
    const portfolio = monthlyReturns.find((item) => item.monthStart === monthStart);
    const entry = {
      month: portfolio?.month,
      monthStart,
      portfolio: portfolio?.returnRate || 0,
    };

    indices.forEach((indexName) => {
      const match = benchmarks.find(
        (item) => item.index === indexName && item.monthStart === monthStart,
      );
      entry[indexName.toLowerCase()] = Number(match?.monthlyRate) || 0;
    });

    return entry;
  });
}

function projectWealth(currentPatrimonio, avgMonthlyReturnPercent, monthsAhead = 12) {
  const rate = Number(avgMonthlyReturnPercent) / 100;
  const projected = Number(currentPatrimonio) * (1 + rate) ** monthsAhead;
  return round2(projected);
}

function buildInvestmentsDashboard(raw, period) {
  const current = raw.portfolioCurrent || {};
  const patrimonio = Number(current.patrimonio) || 0;
  const totalAportado = Number(current.total_aportado) || 0;
  const lucro = Number(current.lucro) || 0;
  const investmentsCount = Number(current.investments_count) || 0;

  const accumulatedReturn =
    totalAportado > 0 ? round2((lucro / totalAportado) * 100) : patrimonio > 0 ? 100 : 0;

  const distribution = normalizeArray(raw.distribution).map((item) => ({
    category: item.category,
    color: item.color,
    icon: item.icon,
    value: Number(item.value) || 0,
    count: Number(item.count) || 0,
  }));

  const totalDistribution = distribution.reduce((sum, item) => sum + item.value, 0);
  const distributionWithPercent = distribution.map((item) => ({
    ...item,
    percent: totalDistribution > 0 ? round2((item.value / totalDistribution) * 100) : 0,
  }));

  const wealthEvolution = normalizeArray(raw.wealthEvolution).map((item) => ({
    month: item.month,
    monthStart: item.monthStart,
    patrimonio: Number(item.patrimonio) || 0,
    aportado: Number(item.aportado) || 0,
  }));

  const contributionsHistory = normalizeArray(raw.contributionsHistory).map((item) => ({
    month: item.month,
    monthStart: item.monthStart,
    value: Number(item.value) || 0,
    count: Number(item.count) || 0,
  }));

  const investments = normalizeArray(raw.investments).map((item) => ({
    id: item.id,
    name: item.name,
    institution: item.institution,
    category: item.category,
    color: item.color,
    icon: item.icon,
    invested: Number(item.invested) || 0,
    currentValue: Number(item.currentValue) || 0,
    profit: Number(item.profit) || 0,
    returnRate: Number(item.returnRate) || 0,
    date: item.date,
  }));

  const benchmarks = normalizeArray(raw.benchmarks).map((item) => ({
    index: item.index,
    month: item.month,
    monthStart: item.monthStart,
    monthlyRate: Number(item.monthlyRate) || 0,
  }));

  const monthlyReturns = buildMonthlyReturns(wealthEvolution);
  const lastMonthlyReturn =
    monthlyReturns.length > 1
      ? monthlyReturns[monthlyReturns.length - 1].returnRate
      : accumulatedReturn;

  const positiveReturns = monthlyReturns
    .map((item) => item.returnRate)
    .filter((rate) => rate !== 0);
  const avgMonthlyReturn =
    positiveReturns.length > 0
      ? round2(positiveReturns.reduce((sum, rate) => sum + rate, 0) / positiveReturns.length)
      : investments.length > 0
        ? round2(
            investments.reduce((sum, item) => sum + item.returnRate, 0) / investments.length,
          )
        : 0;

  const benchmarkComparison = buildBenchmarkComparison(monthlyReturns, benchmarks);

  const projection = {
    avgMonthlyReturn,
    monthsAhead: 12,
    projectedPatrimonio: projectWealth(patrimonio, avgMonthlyReturn, 12),
    method: "rentabilidade_media_mensal",
  };

  return {
    meta: {
      period: period.period,
      startDate: period.startDate,
      endDate: period.endDate,
      compareStartDate: period.compareStartDate,
      compareEndDate: period.compareEndDate,
      granularity: period.granularity,
      generatedAt: new Date().toISOString(),
    },
    kpis: {
      patrimonio: round2(patrimonio),
      totalAportado: round2(totalAportado),
      lucro: round2(lucro),
      accumulatedReturn,
      monthlyReturn: lastMonthlyReturn,
      investmentsCount,
      projectedPatrimonio: projection.projectedPatrimonio,
    },
    charts: {
      distribution: distributionWithPercent,
      wealthEvolution,
      contributionsHistory,
      monthlyReturns,
      benchmarkComparison,
      investments,
    },
    lists: {
      investments,
      topPerformers: [...investments]
        .sort((a, b) => b.returnRate - a.returnRate)
        .slice(0, 5),
      underPerformers: [...investments]
        .filter((item) => item.returnRate < 0)
        .sort((a, b) => a.returnRate - b.returnRate)
        .slice(0, 5),
    },
    projection,
  };
}

module.exports = { buildInvestmentsDashboard };
