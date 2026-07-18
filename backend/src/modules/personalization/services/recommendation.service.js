function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);
}

function buildRecommendations({
  strategy,
  budgets = [],
  snapshot,
  monthlyIncome,
  health,
}) {
  const recommendations = [];
  const focus = new Set(strategy.getRecommendationFocus());
  const income = Number(monthlyIncome) || Number(snapshot.income) || 0;

  const investBudget = budgets.find((item) => item.key === "investimentos");
  if (focus.has("investments") && investBudget) {
    const remaining = Math.max(investBudget.limit - investBudget.used, 0);
    if (remaining > 0) {
      recommendations.push({
        id: "invest-more",
        type: "investment",
        priority: 1,
        title: "Oportunidade de investir",
        message: `Você pode investir mais ${formatBRL(remaining)} este mês.`,
        action: "Abrir investimentos",
        route: "#patrimonio",
      });
    }
  }

  const lazer = budgets.find((item) => item.key === "lazer");
  if (focus.has("leisure") || focus.has("budget")) {
    if (lazer && lazer.used < lazer.limit * 0.6 && lazer.limit > 0) {
      const saved = Math.round(lazer.limit - lazer.used);
      recommendations.push({
        id: "reallocate-leisure",
        type: "opportunity",
        priority: 2,
        title: "Economia em lazer",
        message: `Você gastou menos em lazer. Pode mover ${formatBRL(saved)} para investimentos ou metas.`,
        action: "Ajustar planejamento",
        route: "#metas",
      });
    }
  }

  const foodLike = budgets.find((item) => item.key === "contas");
  if (foodLike && foodLike.usagePercent < 70 && foodLike.limit > 0) {
    recommendations.push({
      id: "under-budget-bills",
      type: "opportunity",
      priority: 3,
      title: "Orçamento sob controle",
      message: `Você está usando só ${foodLike.usagePercent}% do orçamento de contas fixas.`,
      action: null,
      route: "#dashboards/gastos",
    });
  }

  const nearGoal = (snapshot.goals || [])
    .filter((goal) => goal.remaining > 0 && goal.remaining <= Math.max(goal.target * 0.15, 50))
    .sort((a, b) => a.remaining - b.remaining)[0];

  if (focus.has("goals") && nearGoal) {
    recommendations.push({
      id: "accelerate-goal",
      type: "goal",
      priority: 1,
      title: "Antecipe uma meta",
      message: `Faltam ${formatBRL(nearGoal.remaining)} para concluir "${nearGoal.name}".`,
      action: "Ver metas",
      route: "#metas",
    });
  }

  if (income > 0 && health?.meta?.portfolio < income * 3) {
    recommendations.push({
      id: "emergency-low",
      type: "warning",
      priority: 1,
      title: "Reserva de emergência",
      message: "Sua reserva de emergência está abaixo do recomendado (3 meses de renda).",
      action: "Criar reserva",
      route: "#metas",
    });
  }

  const invoiceTotal = (snapshot.cards || []).reduce(
    (sum, card) => sum + Number(card.usedLimit || 0),
    0,
  );
  if (income > 0 && invoiceTotal > 0) {
    const ratio = Math.round((invoiceTotal / income) * 100);
    if (ratio >= 30) {
      recommendations.push({
        id: "invoice-ratio",
        type: "card",
        priority: ratio >= 45 ? 1 : 2,
        title: "Uso do cartão",
        message: `Sua fatura representa ${ratio}% da sua renda.`,
        action: "Ver cartões",
        route: "#dashboards/cartoes",
      });
    }
  }

  return recommendations
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 6);
}

module.exports = { buildRecommendations };
