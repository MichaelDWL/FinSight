function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);
}

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${String(isoDate).slice(0, 10)}T00:00:00`);
  return Math.round((due - today) / 86400000);
}

function buildAlerts({
  budgets = [],
  snapshot,
  notifications = [],
  monthlyIncome,
}) {
  const enabled = new Set(notifications || []);
  const alerts = [];
  const allow = (id) => enabled.size === 0 || enabled.has(id);

  for (const bill of snapshot.pendingBills || []) {
    const days = daysUntil(bill.dueDate);
    if (days === null) continue;
    if (days <= 1 && allow("bills_due")) {
      alerts.push({
        id: `bill-${bill.id}`,
        type: "bill",
        severity: days < 0 ? "critical" : "warning",
        priority: days <= 0 ? 1 : 2,
        message:
          days < 0
            ? `Conta "${bill.description}" está atrasada (${formatBRL(bill.value)}).`
            : days === 0
              ? `Conta "${bill.description}" vence hoje.`
              : `Conta "${bill.description}" vence amanhã.`,
        route: "#contas-despesas",
      });
    }
  }

  const today = new Date().getDate();
  for (const card of snapshot.cards || []) {
    const closingDiff = ((card.closingDay - today + 31) % 31);
    if (closingDiff <= 2 && allow("invoice_closing")) {
      alerts.push({
        id: `card-close-${card.id}`,
        type: "card",
        severity: "info",
        priority: 2,
        message:
          closingDiff === 0
            ? `Cartão "${card.name}" fecha hoje.`
            : `Cartão "${card.name}" fecha em ${closingDiff} dia${closingDiff === 1 ? "" : "s"}.`,
        route: "#contas-cartoes",
      });
    }
  }

  for (const goal of snapshot.goals || []) {
    if (goal.progress >= 90 && goal.progress < 100 && allow("goal_reached")) {
      alerts.push({
        id: `goal-near-${goal.id}`,
        type: "goal",
        severity: "success",
        priority: 2,
        message: `Meta quase concluída: faltam ${formatBRL(goal.remaining)} em "${goal.name}".`,
        route: "#metas",
      });
    }
    if (goal.deadline) {
      const days = daysUntil(goal.deadline);
      if (days !== null && days < 0 && goal.progress < 100 && allow("goal_late")) {
        alerts.push({
          id: `goal-late-${goal.id}`,
          type: "goal",
          severity: "warning",
          priority: 1,
          message: `Meta "${goal.name}" está atrasada.`,
          route: "#metas",
        });
      }
    }
  }

  for (const budget of budgets) {
    if (budget.key === "lazer" && budget.usagePercent >= 100 && allow("overspend")) {
      alerts.push({
        id: "budget-lazer",
        type: "budget",
        severity: "critical",
        priority: 1,
        message: "Orçamento de lazer acabou.",
        route: "#dashboards/gastos",
      });
    } else if (budget.usagePercent >= 100 && allow("overspend")) {
      alerts.push({
        id: `budget-${budget.key}`,
        type: "budget",
        severity: "warning",
        priority: 1,
        message: `Orçamento de ${budget.label.toLowerCase()} ultrapassado (${budget.usagePercent}%).`,
        route: "#dashboards/gastos",
      });
    } else if (budget.usagePercent >= 85 && allow("overspend")) {
      alerts.push({
        id: `budget-warn-${budget.key}`,
        type: "budget",
        severity: "info",
        priority: 3,
        message: `Atenção: você já utilizou ${budget.usagePercent}% do orçamento destinado a ${budget.label.toLowerCase()}.`,
        route: "#dashboards/gastos",
      });
    }

    if (budget.key === "investimentos" && budget.usagePercent < 50 && allow("invest_down")) {
      const remaining = Math.max(budget.limit - budget.used, 0);
      if (remaining > 0) {
        alerts.push({
          id: "invest-below",
          type: "investment",
          severity: "info",
          priority: 3,
          message: `Investimentos abaixo da meta. Ainda faltam ${formatBRL(remaining)}.`,
          route: "#patrimonio",
        });
      }
    }
  }

  const income = Number(monthlyIncome) || Number(snapshot.income) || 0;
  if (income > 0 && snapshot.portfolio < income * 3 && allow("emergency_low")) {
    alerts.push({
      id: "emergency",
      type: "reserve",
      severity: "warning",
      priority: 2,
      message: "Reserva de emergência abaixo da meta.",
      route: "#metas",
    });
  }

  return alerts.sort((a, b) => a.priority - b.priority).slice(0, 10);
}

function buildPersonalizedInsights({ budgets = [], snapshot, strategy }) {
  const insights = [];
  const bias = strategy.getInsightToneBias();

  for (const budget of budgets) {
    if (budget.usagePercent >= 70) {
      insights.push({
        icon: budget.usagePercent >= 100 ? "fa-triangle-exclamation" : "fa-gauge-high",
        tone: budget.usagePercent >= 100 ? "warning" : "neutral",
        text: `Você já utilizou ${budget.usagePercent}% do orçamento destinado a ${budget.label.toLowerCase()}.`,
      });
    }
  }

  const invest = budgets.find((item) => item.key === "investimentos");
  if (invest && invest.used >= invest.limit && invest.limit > 0) {
    insights.push({
      icon: "fa-rocket",
      tone: "positive",
      text: "Excelente! Você investiu acima da meta deste mês.",
    });
  } else if (invest && invest.remaining > 0) {
    insights.push({
      icon: "fa-piggy-bank",
      tone: bias === "growth" ? "warning" : "neutral",
      text: `Faltam ${formatBRL(invest.remaining)} para atingir sua meta de investimentos deste mês.`,
    });
  }

  const under = budgets.find(
    (item) => item.limit > 0 && item.used > 0 && item.usagePercent <= 60,
  );
  if (under) {
    const saved = Math.round(under.limit - under.used);
    insights.push({
      icon: "fa-hand-holding-dollar",
      tone: "positive",
      text: `Você economizou ${formatBRL(saved)} em ${under.label.toLowerCase()}. Deseja transferir esse valor para seus investimentos?`,
    });
  }

  const nearGoal = (snapshot.goals || [])
    .filter((goal) => goal.remaining > 0 && goal.remaining <= 150)
    .sort((a, b) => a.remaining - b.remaining)[0];
  if (nearGoal) {
    insights.push({
      icon: "fa-bullseye",
      tone: "positive",
      text: `Faltam apenas ${formatBRL(nearGoal.remaining)} para concluir sua meta "${nearGoal.name}".`,
    });
  }

  return insights.slice(0, 6);
}

module.exports = { buildAlerts, buildPersonalizedInsights };
