const { BaseStrategy } = require("./base.strategy");
const { PROFILE_TYPES } = require("../constants");

class CustomStrategy extends BaseStrategy {
  constructor() {
    super({
      id: PROFILE_TYPES.CUSTOM,
      title: "Personalizado",
      description: "Planejamento definido manualmente por você.",
    });
  }

  getHomePriority() {
    return ["alerts", "budgets", "goals", "balance", "expenses", "investments", "bills"];
  }

  getInsightToneBias() {
    return "custom";
  }

  getRecommendationFocus() {
    return ["budget", "goals", "investments", "bills"];
  }
}

module.exports = { CustomStrategy };
