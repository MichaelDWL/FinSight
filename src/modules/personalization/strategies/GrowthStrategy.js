const { BaseStrategy } = require("./base.strategy");
const { PROFILE_TYPES } = require("../constants");

class GrowthStrategy extends BaseStrategy {
  constructor() {
    super({
      id: PROFILE_TYPES.CONQUISTADOR,
      title: "Conquistador",
      description: "Foco em acumular patrimônio com velocidade.",
    });
  }

  getHomePriority() {
    return ["investments", "netWorth", "goals", "savings", "alerts", "balance", "bills"];
  }

  getDashboardKpiOrder(dashboard = "general") {
    if (dashboard === "general") {
      return ["netWorth", "investments", "income", "balance", "expenses", "pendingBills"];
    }
    if (dashboard === "investments") {
      return [
        "patrimonio",
        "lucro",
        "projectedPatrimonio",
        "accumulatedReturn",
        "monthlyReturn",
        "totalAportado",
        "investmentsCount",
      ];
    }
    if (dashboard === "expenses") {
      return ["projectedMonthEnd", "total", "avgDaily", "transactionsCount"];
    }
    return super.getDashboardKpiOrder(dashboard);
  }

  getInsightToneBias() {
    return "growth";
  }

  getRecommendationFocus() {
    return ["investments", "goals", "savings", "budget"];
  }

  getHiddenWidgets() {
    return ["leisureHighlight"];
  }
}

module.exports = { GrowthStrategy };
