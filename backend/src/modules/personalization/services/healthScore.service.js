function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function buildHealthScore({
  monthlyIncome,
  snapshot,
  budgets = [],
  allocation = {},
}) {
  const income = Number(monthlyIncome) || Number(snapshot.income) || 0;
  const expenses = Number(snapshot.expenses) || 0;
  const portfolio = Number(snapshot.portfolio) || 0;
  const investedCapital = Number(snapshot.investedCapital) || 0;

  const commitment = income > 0 ? expenses / income : expenses > 0 ? 1 : 0;
  const investTarget = (Number(allocation.investimentos) || 0) / 100;
  const investRatio = income > 0 ? portfolio / Math.max(income * 6, 1) : 0;
  const monthlyInvestRatio =
    income > 0 ? (Number(snapshot.investedExpenses) || 0) / income : 0;

  const overdueBills = (snapshot.pendingBills || []).filter((bill) => {
    if (!bill.dueDate) return false;
    return new Date(`${String(bill.dueDate).slice(0, 10)}T00:00:00`) < new Date();
  }).length;

  const totalLimit = (snapshot.cards || []).reduce(
    (sum, card) => sum + Number(card.totalLimit || 0),
    0,
  );
  const usedLimit = (snapshot.cards || []).reduce(
    (sum, card) => sum + Number(card.usedLimit || 0),
    0,
  );
  const cardUtilization = totalLimit > 0 ? usedLimit / totalLimit : 0;

  const goals = snapshot.goals || [];
  const goalProgress =
    goals.length > 0
      ? goals.reduce((sum, goal) => sum + Number(goal.progress || 0), 0) / goals.length / 100
      : 0.5;

  const budgetCompliance =
    budgets.length > 0
      ? budgets.filter((item) => item.usagePercent <= 100).length / budgets.length
      : 0.7;

  const emergencyTarget = income * 3;
  const emergencyRatio =
    emergencyTarget > 0 ? clamp(portfolio / emergencyTarget, 0, 1.2) : 0.5;

  const factors = [
    {
      id: "income-commitment",
      label: "Comprometimento da renda",
      weight: 20,
      score: round2(clamp(1 - commitment / 0.9, 0, 1) * 20),
    },
    {
      id: "invested-percent",
      label: "Percentual investido",
      weight: 15,
      score: round2(
        clamp(monthlyInvestRatio / Math.max(investTarget || 0.2, 0.05), 0, 1) * 15,
      ),
    },
    {
      id: "overdue-bills",
      label: "Contas atrasadas",
      weight: 15,
      score: round2(clamp(1 - overdueBills / 3, 0, 1) * 15),
    },
    {
      id: "card-usage",
      label: "Uso do cartão",
      weight: 10,
      score: round2(clamp(1 - cardUtilization / 0.8, 0, 1) * 10),
    },
    {
      id: "emergency-reserve",
      label: "Reserva de emergência",
      weight: 15,
      score: round2(clamp(emergencyRatio, 0, 1) * 15),
    },
    {
      id: "goals",
      label: "Cumprimento das metas",
      weight: 15,
      score: round2(clamp(goalProgress, 0, 1) * 15),
    },
    {
      id: "budget",
      label: "Orçamento mensal",
      weight: 10,
      score: round2(clamp(budgetCompliance, 0, 1) * 10),
    },
  ];

  const score = round2(
    clamp(
      factors.reduce((sum, factor) => sum + factor.score, 0),
      0,
      100,
    ),
  );

  return {
    score,
    label:
      score >= 80 ? "Excelente" : score >= 60 ? "Boa" : score >= 40 ? "Atenção" : "Crítica",
    factors,
    meta: {
      commitment: round2(commitment * 100),
      cardUtilization: round2(cardUtilization * 100),
      portfolio,
      investedCapital,
      overdueBills,
    },
  };
}

module.exports = { buildHealthScore };
