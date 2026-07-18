const { round2 } = require("./financialHealth.engine");

function formatCurrency(value) {
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

function dueLabel(days) {
  if (days === null || days === undefined) return "Sem prazo";
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanha";
  if (days < 0) return `${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"} atrasado`;
  return `Em ${days} dias`;
}

function buildInsights({
  income,
  expenses,
  previousExpenses,
  monthlyBalance,
  monthlyFlow,
  categoryComparison,
  upcomingBills,
  cards,
  netWorth,
}) {
  const insights = [];

  const topGrowing = [...categoryComparison]
    .map((item) => ({
      category: item.category,
      change:
        item.previousMonth > 0
          ? round2(((item.currentMonth - item.previousMonth) / item.previousMonth) * 100)
          : null,
    }))
    .filter((item) => item.change !== null && item.change < 0)
    .sort((a, b) => a.change - b.change)[0];

  if (topGrowing) {
    insights.push({
      icon: "fa-arrow-trend-down",
      tone: "positive",
      text: `Voce gastou ${Math.abs(topGrowing.change)}% menos em ${topGrowing.category.toLowerCase()}.`,
    });
  }

  const fastestGrowing = [...categoryComparison]
    .map((item) => ({
      category: item.category,
      change:
        item.previousMonth > 0
          ? round2(((item.currentMonth - item.previousMonth) / item.previousMonth) * 100)
          : item.currentMonth > 0
            ? 100
            : 0,
    }))
    .filter((item) => item.change > 10 && item.currentMonth > 0)
    .sort((a, b) => b.change - a.change)[0];

  if (fastestGrowing) {
    insights.push({
      icon: "fa-chart-line",
      tone: fastestGrowing.change >= 50 ? "warning" : "neutral",
      text: `${fastestGrowing.category} cresceu ${fastestGrowing.change}% no periodo.`,
    });
  }

  const nextBill = upcomingBills[0];
  if (nextBill) {
    const days = daysUntil(nextBill.dueDate);
    if (days !== null && days >= -3 && days <= 7) {
      insights.push({
        icon: "fa-calendar-day",
        tone: days <= 2 ? "warning" : "neutral",
        text: `Sua proxima conta vence ${dueLabel(days).toLowerCase()}.`,
      });
    }
  }

  if (monthlyFlow.length >= 2) {
    const current = monthlyFlow[monthlyFlow.length - 1];
    const previous = monthlyFlow[monthlyFlow.length - 2];
    const flowChange = round2(Number(current.balance || 0) - Number(previous.balance || 0));

    if (flowChange !== 0) {
      insights.push({
        icon: flowChange > 0 ? "fa-chart-line" : "fa-circle-exclamation",
        tone: flowChange > 0 ? "positive" : "warning",
        text:
          flowChange > 0
            ? `Seu fluxo mensal melhorou ${formatCurrency(flowChange)} em relacao ao mes anterior.`
            : `Seu fluxo mensal caiu ${formatCurrency(Math.abs(flowChange))} em relacao ao mes anterior.`,
      });
    }
  }

  if (monthlyBalance > 0) {
    insights.push({
      icon: "fa-piggy-bank",
      tone: "positive",
      text: `Voce ainda possui ${formatCurrency(monthlyBalance)} livres no periodo selecionado.`,
    });
  } else if (monthlyBalance < 0) {
    insights.push({
      icon: "fa-triangle-exclamation",
      tone: "warning",
      text: `Suas despesas superaram as receitas em ${formatCurrency(Math.abs(monthlyBalance))} no periodo.`,
    });
  }

  const mostUsedCard = [...cards]
    .map((card) => ({
      name: card.name,
      percent:
        Number(card.totalLimit) > 0
          ? Math.round((Number(card.usedLimit) / Number(card.totalLimit)) * 100)
          : 0,
    }))
    .sort((a, b) => b.percent - a.percent)[0];

  if (mostUsedCard && mostUsedCard.percent >= 50) {
    insights.push({
      icon: "fa-credit-card",
      tone: mostUsedCard.percent >= 80 ? "warning" : "neutral",
      text: `Seu cartao ${mostUsedCard.name} ja utilizou ${mostUsedCard.percent}% do limite.`,
    });
  }

  if (previousExpenses > 0) {
    const expenseChange = round2(((expenses - previousExpenses) / previousExpenses) * 100);
    if (expenseChange <= -5) {
      insights.push({
        icon: "fa-circle-check",
        tone: "positive",
        text: `Suas despesas caíram ${Math.abs(expenseChange)}% em relacao ao periodo anterior.`,
      });
    }
  }

  if (!insights.length) {
    insights.push({
      icon: "fa-seedling",
      tone: "neutral",
      text: `Seu patrimonio consolidado e de ${formatCurrency(netWorth)} entre contas e investimentos.`,
    });
  }

  return insights.slice(0, 5);
}

module.exports = { buildInsights };
