class BaseStrategy {
  constructor({ id, title, description }) {
    this.id = id;
    this.title = title;
    this.description = description;
  }

  getHomePriority() {
    return ["alerts", "balance", "budgets", "goals", "insights", "investments", "bills"];
  }

  getDashboardKpiOrder(dashboard = "general") {
    const map = {
      general: ["balance", "netWorth", "income", "expenses", "investments", "pendingBills"],
      expenses: ["total", "avgDaily", "projectedMonthEnd", "transactionsCount"],
      cashflow: [
        "income",
        "expenses",
        "net",
        "projectedBalance",
        "currentBalance",
        "accumulatedBalance",
        "avgDailyIncome",
        "avgDailyExpense",
      ],
      cards: ["usagePercent", "usedLimit", "availableLimit", "totalLimit"],
      investments: [
        "patrimonio",
        "lucro",
        "projectedPatrimonio",
        "accumulatedReturn",
        "monthlyReturn",
        "totalAportado",
        "investmentsCount",
      ],
    };
    return map[dashboard] || map.general;
  }

  getInsightToneBias() {
    return "balanced";
  }

  getRecommendationFocus() {
    return ["budget", "goals", "investments", "bills"];
  }

  getHiddenWidgets() {
    return [];
  }

  describe() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      homePriority: this.getHomePriority(),
      kpiOrder: {
        general: this.getDashboardKpiOrder("general"),
        expenses: this.getDashboardKpiOrder("expenses"),
        cashflow: this.getDashboardKpiOrder("cashflow"),
        cards: this.getDashboardKpiOrder("cards"),
        investments: this.getDashboardKpiOrder("investments"),
      },
      insightToneBias: this.getInsightToneBias(),
      recommendationFocus: this.getRecommendationFocus(),
      hiddenWidgets: this.getHiddenWidgets(),
    };
  }
}

module.exports = { BaseStrategy };
