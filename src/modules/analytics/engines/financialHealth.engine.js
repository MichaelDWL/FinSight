function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function scoreFromRatio(ratio, { ideal = 1, weight }) {
  const normalized = clamp(ratio / ideal, 0, 1);
  return round2(normalized * weight);
}

function scoreInverseRatio(ratio, { max = 1, weight }) {
  const normalized = clamp(1 - ratio / max, 0, 1);
  return round2(normalized * weight);
}

function buildFinancialHealth({
  income,
  expenses,
  previousIncome,
  previousExpenses,
  pendingBillsTotal,
  cards,
  monthlyFlow,
}) {
  const monthlyBalance = income - expenses;
  const savingsRate = income > 0 ? monthlyBalance / income : monthlyBalance >= 0 ? 1 : 0;

  const expenseTrend =
    previousExpenses > 0
      ? (expenses - previousExpenses) / previousExpenses
      : expenses > 0
        ? 1
        : 0;

  const pendingRatio = income > 0 ? pendingBillsTotal / income : pendingBillsTotal > 0 ? 1 : 0;

  const totalLimit = cards.reduce((sum, card) => sum + Number(card.totalLimit || 0), 0);
  const totalUsed = cards.reduce((sum, card) => sum + Number(card.usedLimit || 0), 0);
  const cardUtilization = totalLimit > 0 ? totalUsed / totalLimit : 0;

  const balances = monthlyFlow.map((item) => Number(item.balance || 0));
  let flowConsistency = 1;
  if (balances.length >= 2) {
    const mean = balances.reduce((sum, value) => sum + value, 0) / balances.length;
    const variance =
      balances.reduce((sum, value) => sum + (value - mean) ** 2, 0) / balances.length;
    const stdDev = Math.sqrt(variance);
    const reference = Math.max(Math.abs(mean), 1);
    flowConsistency = clamp(1 - stdDev / reference, 0, 1);
  }

  const factors = [
    {
      id: "savings-rate",
      label: "Taxa de poupanca",
      weight: 25,
      score: scoreFromRatio(Math.max(savingsRate, 0), { ideal: 0.3, weight: 25 }),
      detail:
        savingsRate >= 0
          ? `${Math.round(Math.max(savingsRate, 0) * 100)}% do periodo poupado`
          : "Despesas acima das receitas",
    },
    {
      id: "expense-trend",
      label: "Tendencia de despesas",
      weight: 20,
      score: scoreInverseRatio(Math.max(expenseTrend, 0), { max: 0.5, weight: 20 }),
      detail:
        expenseTrend <= 0
          ? "Despesas estaveis ou em queda"
          : `Despesas cresceram ${Math.round(expenseTrend * 100)}%`,
    },
    {
      id: "pending-bills",
      label: "Contas pendentes",
      weight: 20,
      score: scoreInverseRatio(pendingRatio, { max: 1, weight: 20 }),
      detail:
        pendingBillsTotal > 0
          ? `Compromissos pendentes representam ${Math.round(pendingRatio * 100)}% da receita`
          : "Sem contas pendentes relevantes",
    },
    {
      id: "card-utilization",
      label: "Uso de cartao",
      weight: 15,
      score: scoreInverseRatio(cardUtilization, { max: 1, weight: 15 }),
      detail:
        totalLimit > 0
          ? `${Math.round(cardUtilization * 100)}% do limite utilizado`
          : "Sem cartoes cadastrados",
    },
    {
      id: "flow-consistency",
      label: "Consistencia de fluxo",
      weight: 20,
      score: round2(flowConsistency * 20),
      detail:
        balances.length >= 2
          ? "Baseado na estabilidade do fluxo mensal"
          : "Historico insuficiente para medir consistencia",
    },
  ];

  const value = clamp(Math.round(factors.reduce((sum, factor) => sum + factor.score, 0)), 0, 100);

  let tone = "neutral";
  if (value >= 75) tone = "positive";
  else if (value < 50) tone = "warning";

  return { value, tone, factors };
}

module.exports = { buildFinancialHealth, round2 };
