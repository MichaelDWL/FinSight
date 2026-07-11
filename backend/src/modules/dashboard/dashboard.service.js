const accountsService = require("../accounts/accounts.service");
const cardsService = require("../cards/cards.service");
const goalsService = require("../goals/goals.service");
const investmentsService = require("../investments/investments.service");
const movementsService = require("../movements/movements.service");
const recurrenceService = require("../../services/recurrenceService");
const repository = require("./dashboard.repository");

async function getDashboard(userId) {
  // Geracao lazy: garante que as contas recorrentes do mes ja existam
  // antes de consolidar os numeros exibidos ao usuario.
  await recurrenceService.ensureGenerated(userId);

  const [summary, transactions, accounts, cards, bills, investments, goals] = await Promise.all([
    repository.getFinancialSummary(userId),
    movementsService.listTransactions(userId),
    accountsService.list(userId),
    cardsService.list(userId),
    movementsService.listBills(userId),
    investmentsService.list(userId),
    goalsService.list(userId),
  ]);

  const monthlyBalance = summary.income - summary.expenses;
  const pendingBills = bills.filter((bill) => bill.status !== "paid");

  return {
    ...summary,
    monthlyBalance,
    accounts,
    cards,
    bills,
    pendingBills,
    latestTransactions: transactions.slice(0, 6),
    transactions,
    investments,
    goals,
    insights: [
      {
        title: "Resumo mensal",
        description:
          monthlyBalance >= 0
            ? "Suas receitas cobrem as despesas registradas neste periodo."
            : "As despesas superaram as receitas registradas neste periodo.",
        tone: monthlyBalance >= 0 ? "positive" : "warning",
      },
      {
        title: "Patrimonio consolidado",
        description: "Contas e investimentos foram consolidados diretamente do PostgreSQL.",
        tone: "neutral",
      },
    ],
  };
}

module.exports = { getDashboard };
