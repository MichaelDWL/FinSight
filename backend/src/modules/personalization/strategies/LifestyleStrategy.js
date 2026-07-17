const { BaseStrategy } = require("./base.strategy");
const { PROFILE_TYPES } = require("../constants");

class LifestyleStrategy extends BaseStrategy {
  constructor() {
    super({
      id: PROFILE_TYPES.APROVEITADOR,
      title: "Aproveitador",
      description: "Aproveitar o presente com organização.",
    });
  }

  getHomePriority() {
    return ["balance", "leisure", "expenses", "bills", "goals", "alerts", "investments"];
  }

  getDashboardKpiOrder(dashboard = "general") {
    if (dashboard === "general") {
      return ["balance", "expenses", "income", "pendingBills", "netWorth", "investments"];
    }
    if (dashboard === "expenses") {
      return ["total", "avgDaily", "projectedMonthEnd", "transactionsCount"];
    }
    if (dashboard === "cashflow") {
      return [
        "expenses",
        "income",
        "net",
        "currentBalance",
        "projectedBalance",
        "accumulatedBalance",
        "avgDailyExpense",
        "avgDailyIncome",
      ];
    }
    if (dashboard === "cards") {
      return ["availableLimit", "usagePercent", "usedLimit", "totalLimit"];
    }
    return super.getDashboardKpiOrder(dashboard);
  }

  getInsightToneBias() {
    return "lifestyle";
  }

  getRecommendationFocus() {
    return ["budget", "bills", "goals", "leisure"];
  }

  getHiddenWidgets() {
    return ["aggressiveGrowth"];
  }
}

module.exports = { LifestyleStrategy };
