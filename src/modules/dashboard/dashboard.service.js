const accountsService = require("../accounts/accounts.service");
const cardsService = require("../cards/cards.service");
const goalsService = require("../goals/goals.service");
const investmentsService = require("../investments/investments.service");
const movementsService = require("../movements/movements.service");
const recurrenceService = require("../../services/recurrenceService");
const repository = require("./dashboard.repository");
const personalizationEngine = require("../personalization/engine/PersonalizationEngine");

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function calcTrend(current, previous) {
  const curr = Number(current) || 0;
  const prev = Number(previous) || 0;

  if (prev === 0 && curr === 0) {
    return { direction: "neutral", percent: 0, label: "Sem variação" };
  }

  if (prev === 0) {
    return { direction: "up", percent: 100, label: "+100% vs mês anterior" };
  }

  const change = round2(((curr - prev) / Math.abs(prev)) * 100);
  const direction = change > 0 ? "up" : change < 0 ? "down" : "neutral";
  const sign = change > 0 ? "+" : "";

  return {
    direction,
    percent: Math.abs(change),
    label: `${sign}${change}% vs mês anterior`,
  };
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
  if (days === 1) return "Amanhã";
  if (days < 0) return `${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"} atrasado`;
  return `Em ${days} dias`;
}

function getNextCardDueDate(card) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = Number(card.dueDay) || 1;

  let due = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (due < today) {
    due = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
  }

  return due;
}

function buildFlowSummary(categoryComparison, topIncome) {
  const currentCategories = categoryComparison
    .filter((item) => item.currentMonth > 0)
    .sort((a, b) => b.currentMonth - a.currentMonth);

  const topExpenseCategory = currentCategories[0] || null;

  const fastestGrowing = [...categoryComparison]
    .map((item) => {
      const growth =
        item.previousMonth > 0
          ? round2(((item.currentMonth - item.previousMonth) / item.previousMonth) * 100)
          : item.currentMonth > 0
            ? 100
            : 0;

      return { ...item, growth };
    })
    .filter((item) => item.currentMonth > 0 && item.growth > 0)
    .sort((a, b) => b.growth - a.growth)[0];

  return {
    topExpenseCategory: topExpenseCategory
      ? {
          name: topExpenseCategory.category,
          value: topExpenseCategory.currentMonth,
        }
      : null,
    fastestGrowingCategory: fastestGrowing
      ? {
          name: fastestGrowing.category,
          growth: fastestGrowing.growth,
          value: fastestGrowing.currentMonth,
        }
      : null,
    topIncome: topIncome
      ? {
          name: topIncome.description,
          category: topIncome.category,
          value: topIncome.value,
        }
      : null,
  };
}

function buildFinancialHealth({ pendingBills, cards, goals }) {
  const today = new Date().toISOString().slice(0, 10);
  const sortedBills = [...pendingBills].sort((a, b) =>
    String(a.dueDate).localeCompare(String(b.dueDate)),
  );

  const dueToday = sortedBills.filter((bill) => String(bill.dueDate).slice(0, 10) === today);
  const nextBill = sortedBills.find((bill) => String(bill.dueDate).slice(0, 10) >= today) || null;

  const nextCard = [...cards]
    .map((card) => ({
      ...card,
      dueDate: getNextCardDueDate(card).toISOString().slice(0, 10),
      days: daysUntil(getNextCardDueDate(card).toISOString().slice(0, 10)),
    }))
    .sort((a, b) => a.days - b.days)[0];

  const totalCardLimit = cards.reduce((sum, card) => sum + Number(card.totalLimit || 0), 0);
  const totalCardAvailable = cards.reduce(
    (sum, card) => sum + Math.max(Number(card.totalLimit || 0) - Number(card.usedLimit || 0), 0),
    0,
  );

  const nearestGoal = [...goals]
    .filter((goal) => goal.status !== "concluida")
    .sort((a, b) => {
      if (a.deadline && b.deadline) {
        return String(a.deadline).localeCompare(String(b.deadline));
      }
      return Number(b.progress || 0) - Number(a.progress || 0);
    })[0];

  const items = [];

  items.push({
    id: "due-today",
    icon: "fa-calendar-day",
    label: "Contas vencendo hoje",
    value: dueToday.length ? `${dueToday.length} conta${dueToday.length === 1 ? "" : "s"}` : "Nenhuma",
    meta: dueToday.length
      ? formatCurrency(dueToday.reduce((sum, bill) => sum + Number(bill.value || 0), 0))
      : "Tudo em dia",
    tone: dueToday.length ? "warning" : "positive",
    href: "#contas-despesas",
  });

  if (nextBill) {
    const days = daysUntil(nextBill.dueDate);
    items.push({
      id: "next-bill",
      icon: "fa-file-invoice-dollar",
      label: "Próxima conta",
      value: nextBill.name,
      meta: `${formatCurrency(nextBill.value)} · ${dueLabel(days)}`,
      tone: days !== null && days <= 2 ? "warning" : "neutral",
      href: "#contas-despesas",
    });
  }

  if (nextCard) {
    items.push({
      id: "next-invoice",
      icon: "fa-credit-card",
      label: "Próxima fatura",
      value: nextCard.name,
      meta: `${formatCurrency(nextCard.invoiceCurrent || nextCard.nextInvoice || 0)} · ${dueLabel(nextCard.days)}`,
      tone: nextCard.days !== null && nextCard.days <= 3 ? "warning" : "neutral",
      href: "#contas-cartoes",
    });
  }

  items.push({
    id: "card-limit",
    icon: "fa-wallet",
    label: "Limite nos cartões",
    value: formatCurrency(totalCardAvailable),
    meta: totalCardLimit
      ? `${Math.round((1 - totalCardAvailable / totalCardLimit) * 100)}% utilizado`
      : "Sem cartões",
    tone:
      totalCardLimit && totalCardAvailable / totalCardLimit < 0.2 ? "warning" : "neutral",
    href: "#contas-cartoes",
  });

  if (nearestGoal) {
    items.push({
      id: "nearest-goal",
      icon: "fa-bullseye",
      label: "Meta mais próxima",
      value: nearestGoal.name,
      meta: `${Math.round(Number(nearestGoal.progress || 0))}% · ${formatCurrency(nearestGoal.current)}`,
      tone: "positive",
      href: "#metas",
    });
  }

  return items;
}

function buildWealthBreakdown(accounts, investmentsTotal, cards) {
  const bankAccounts = accounts.filter(
    (account) => !["dinheiro", "carteira"].includes(String(account.type || "").toLowerCase()),
  );
  const cashAccounts = accounts.filter((account) =>
    ["dinheiro", "carteira"].includes(String(account.type || "").toLowerCase()),
  );

  const accountsTotal = bankAccounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
  const cashTotal = cashAccounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
  const cardsAvailable = cards.reduce(
    (sum, card) => sum + Math.max(Number(card.totalLimit || 0) - Number(card.usedLimit || 0), 0),
    0,
  );

  return {
    accounts: round2(accountsTotal),
    investments: round2(investmentsTotal),
    cash: round2(cashTotal),
    cardsAvailable: round2(cardsAvailable),
  };
}

function buildInsights({
  summary,
  previousMonth,
  monthlyFlow,
  categoryComparison,
  pendingBills,
  cards,
  wealthBreakdown,
}) {
  const insights = [];
  const monthlyBalance = summary.income - summary.expenses;

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
      text: `Você gastou ${Math.abs(topGrowing.change)}% menos em ${topGrowing.category.toLowerCase()}.`,
    });
  }

  const nextBill = [...pendingBills]
    .filter((bill) => bill.status !== "paid")
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];

  if (nextBill) {
    const days = daysUntil(nextBill.dueDate);
    if (days !== null && days >= 0 && days <= 7) {
      insights.push({
        icon: "fa-calendar-day",
        tone: days <= 2 ? "warning" : "neutral",
        text: `Sua próxima conta vence ${dueLabel(days).toLowerCase()}.`,
      });
    }
  }

  if (monthlyFlow.length >= 2) {
    const current = monthlyFlow[monthlyFlow.length - 1];
    const previous = monthlyFlow[monthlyFlow.length - 2];
    const patrimonyChange = round2(current.balance - previous.balance);

    if (patrimonyChange !== 0) {
      insights.push({
        icon: patrimonyChange > 0 ? "fa-chart-line" : "fa-circle-exclamation",
        tone: patrimonyChange > 0 ? "positive" : "warning",
        text:
          patrimonyChange > 0
            ? `Seu fluxo mensal melhorou ${formatCurrency(patrimonyChange)} em relação ao mês anterior.`
            : `Seu fluxo mensal caiu ${formatCurrency(Math.abs(patrimonyChange))} em relação ao mês anterior.`,
      });
    }
  }

  if (monthlyBalance > 0) {
    insights.push({
      icon: "fa-piggy-bank",
      tone: "positive",
      text: `Você ainda possui ${formatCurrency(monthlyBalance)} livres no orçamento deste mês.`,
    });
  } else if (monthlyBalance < 0) {
    insights.push({
      icon: "fa-triangle-exclamation",
      tone: "warning",
      text: `Suas despesas superaram as receitas em ${formatCurrency(Math.abs(monthlyBalance))} neste mês.`,
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
      text: `Seu cartão ${mostUsedCard.name} já utilizou ${mostUsedCard.percent}% do limite.`,
    });
  }

  const expenseTrend = calcTrend(summary.expenses, previousMonth.expenses);
  if (expenseTrend.direction === "down" && expenseTrend.percent >= 5) {
    insights.push({
      icon: "fa-circle-check",
      tone: "positive",
      text: `Suas despesas caíram ${expenseTrend.percent}% em relação ao mês passado.`,
    });
  }

  if (!insights.length) {
    insights.push({
      icon: "fa-seedling",
      tone: "neutral",
      text: `Seu patrimônio consolidado é de ${formatCurrency(summary.netWorth)} entre contas e investimentos.`,
    });
  }

  return insights.slice(0, 5);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);
}

async function getDashboard(userId) {
  await recurrenceService.ensureGenerated(userId);

  const [
    summary,
    previousMonth,
    monthlyFlow,
    categoryComparison,
    topIncome,
    currentInvoices,
    transactions,
    accounts,
    cards,
    bills,
    investments,
    goals,
    personalization,
  ] = await Promise.all([
    repository.getFinancialSummary(userId),
    repository.getPreviousMonthSummary(userId),
    repository.getMonthlyFlow(userId, 6),
    repository.getCategorySpendingComparison(userId),
    repository.getTopIncomeThisMonth(userId),
    repository.getCurrentMonthInvoices(userId),
    movementsService.listTransactions(userId),
    accountsService.list(userId),
    cardsService.list(userId),
    movementsService.listBills(userId),
    investmentsService.list(userId),
    goalsService.list(userId),
    personalizationEngine.rebuildContext(userId).catch(() => null),
  ]);

  const monthlyBalance = summary.income - summary.expenses;
  const pendingBills = bills.filter((bill) => bill.status !== "paid");
  const wealthBreakdown = buildWealthBreakdown(accounts, summary.investmentsTotal, cards);

  const baseInsights = buildInsights({
    summary,
    previousMonth,
    monthlyFlow,
    categoryComparison,
    pendingBills,
    cards,
    wealthBreakdown,
  });

  const insights = personalization?.insights?.length
    ? [...personalization.insights, ...baseInsights].slice(0, 8)
    : baseInsights;

  return {
    ...summary,
    monthlyBalance,
    trends: {
      balance: calcTrend(summary.balance, summary.balance - monthlyBalance),
      income: calcTrend(summary.income, previousMonth.income),
      expenses: calcTrend(summary.expenses, previousMonth.expenses),
      netWorth: calcTrend(summary.netWorth, summary.netWorth - monthlyBalance),
    },
    monthlyFlow,
    flowSummary: buildFlowSummary(categoryComparison, topIncome),
    currentInvoices,
    financialHealth: buildFinancialHealth({ pendingBills, cards, goals }),
    wealthBreakdown,
    accounts,
    cards,
    bills,
    pendingBills,
    latestTransactions: transactions.slice(0, 6),
    transactions,
    investments,
    goals,
    insights,
    personalization,
    alerts: personalization?.alerts || [],
    recommendations: personalization?.recommendations || [],
    budgets: personalization?.budgets || [],
    progress: personalization?.progress || [],
    healthScore: personalization?.health || null,
  };
}

module.exports = { getDashboard };
