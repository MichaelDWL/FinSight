const {
  FIXED_INCOME_TYPES,
  PROJECTION_DISCLAIMER,
  PROJECTION_HORIZONS_MONTHS,
  SAVINGS_FLAT_MONTHLY,
  SAVINGS_SELIC_THRESHOLD,
  VARIABLE_INCOME_TYPES,
} = require("../market-data/market.constants");

function round2(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function annualToMonthlyRate(annualPercent) {
  const annual = Number(annualPercent) || 0;
  return (1 + annual / 100) ** (1 / 12) - 1;
}

function resolveAnnualRate(investment, rates) {
  const type = investment.investmentType || investment.tipo_investimento;
  const selic = Number(rates?.selic) || 0;
  const cdi = Number(rates?.cdi) || selic;
  const ipcaAnnual = Number(rates?.ipca) != null ? Number(rates.ipca) * 12 : 0;

  switch (type) {
    case "tesouro_selic":
      return selic;
    case "tesouro_ipca": {
      const spread = Number(investment.ipcaSpread ?? investment.taxa_ipca_spread) || 0;
      return ipcaAnnual + spread;
    }
    case "tesouro_prefixado":
      return Number(investment.prefixedRate ?? investment.taxa_prefixada) || 0;
    case "cdb":
    case "lci":
    case "lca": {
      if (investment.prefixedRate != null || investment.taxa_prefixada != null) {
        return Number(investment.prefixedRate ?? investment.taxa_prefixada) || 0;
      }
      const pct = Number(investment.cdiPercent ?? investment.percentual_cdi) || 100;
      return cdi * (pct / 100);
    }
    case "poupanca":
      return resolveSavingsAnnual(selic);
    default:
      return 0;
  }
}

function resolveSavingsAnnual(selic) {
  if (selic <= SAVINGS_SELIC_THRESHOLD) {
    return selic * 0.7;
  }
  return ((1 + SAVINGS_FLAT_MONTHLY / 100) ** 12 - 1) * 100;
}

function projectAmount(principal, monthlyRate, months) {
  return principal * (1 + monthlyRate) ** months;
}

function buildHorizon(principal, monthlyRate, months, rates) {
  const estimated = projectAmount(principal, monthlyRate, months);
  const profit = estimated - principal;
  const returnPct = principal > 0 ? (profit / principal) * 100 : 0;

  const ipcaMonthly = annualToMonthlyRate((Number(rates?.ipca) || 0) * 12);
  const inflationValue = projectAmount(principal, ipcaMonthly, months);

  const savingsAnnual = resolveSavingsAnnual(Number(rates?.selic) || 0);
  const savingsMonthly = annualToMonthlyRate(savingsAnnual);
  const savingsValue = projectAmount(principal, savingsMonthly, months);

  return {
    months,
    label: formatHorizonLabel(months),
    invested: round2(principal),
    estimatedProfit: round2(profit),
    returnPercent: round2(returnPct),
    estimatedWealth: round2(estimated),
    vsInflation: {
      inflationWealth: round2(inflationValue),
      realGain: round2(estimated - inflationValue),
    },
    vsSavings: {
      savingsWealth: round2(savingsValue),
      extraGain: round2(estimated - savingsValue),
    },
  };
}

function formatHorizonLabel(months) {
  if (months === 3) return "3 meses";
  if (months === 6) return "6 meses";
  if (months === 12) return "1 ano";
  if (months === 24) return "2 anos";
  if (months === 60) return "5 anos";
  return `${months} meses`;
}

function projectFixedIncome(investment, rates) {
  const principal = Number(investment.invested ?? investment.valor_inicial) || 0;
  const annualRate = resolveAnnualRate(investment, rates);
  const monthlyRate = annualToMonthlyRate(annualRate);

  return {
    kind: "fixed_income",
    annualRate: round2(annualRate),
    monthlyRate: round2(monthlyRate * 100),
    ratesUsed: {
      selic: rates?.selic ?? null,
      cdi: rates?.cdi ?? null,
      ipca: rates?.ipca ?? null,
    },
    horizons: PROJECTION_HORIZONS_MONTHS.map((months) =>
      buildHorizon(principal, monthlyRate, months, rates)
    ),
    disclaimer: PROJECTION_DISCLAIMER,
  };
}

function buildVariableIncomeView(investment, marketAsset) {
  return {
    kind: "variable_income",
    forecast: null,
    message: "Renda variavel nao possui previsao de preco futuro.",
    market: marketAsset
      ? {
          assetCode: marketAsset.assetCode,
          currentPrice: marketAsset.currentPrice,
          dailyChange: marketAsset.dailyChange,
          monthlyChange: marketAsset.monthlyChange,
          yearlyChange: marketAsset.yearlyChange,
          currency: marketAsset.currency,
          lastUpdate: marketAsset.lastUpdate,
          stats: marketAsset.stats || null,
          history: marketAsset.history || [],
        }
      : null,
    disclaimer: PROJECTION_DISCLAIMER,
  };
}

function projectPortfolio(investments, rates) {
  const principals = investments.map((item) => Number(item.invested ?? item.valor_inicial) || 0);
  const currents = investments.map((item) => Number(item.value ?? item.valor_atual) || 0);
  const totalInvested = principals.reduce((sum, value) => sum + value, 0);
  const totalCurrent = currents.reduce((sum, value) => sum + value, 0);

  const horizons = PROJECTION_HORIZONS_MONTHS.map((months) => {
    let estimated = 0;

    investments.forEach((item, index) => {
      const type = item.investmentType || item.tipo_investimento;
      const current = currents[index];
      const invested = principals[index];

      if (FIXED_INCOME_TYPES.has(type)) {
        const annualRate = resolveAnnualRate(item, rates);
        const monthlyRate = annualToMonthlyRate(annualRate);
        estimated += projectAmount(current || invested, monthlyRate, months);
      } else {
        // Renda variavel: mantem valor atual sem projetar valorizacao.
        estimated += current || invested;
      }
    });

    const profit = estimated - totalInvested;
    return {
      months,
      label: formatHorizonLabel(months),
      invested: round2(totalInvested),
      currentWealth: round2(totalCurrent),
      estimatedWealth: round2(estimated),
      estimatedProfit: round2(profit),
      returnPercent: totalInvested > 0 ? round2((profit / totalInvested) * 100) : 0,
    };
  });

  return {
    invested: round2(totalInvested),
    currentWealth: round2(totalCurrent),
    horizons,
    disclaimer: PROJECTION_DISCLAIMER,
  };
}

function isFixedIncome(type) {
  return FIXED_INCOME_TYPES.has(type);
}

function isVariableIncome(type) {
  return VARIABLE_INCOME_TYPES.has(type);
}

module.exports = {
  buildVariableIncomeView,
  isFixedIncome,
  isVariableIncome,
  projectFixedIncome,
  projectPortfolio,
  resolveAnnualRate,
};
