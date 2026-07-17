const { BaseStrategy } = require("./base.strategy");
const { PROFILE_TYPES } = require("../constants");

class BalancedStrategy extends BaseStrategy {
  constructor() {
    super({
      id: PROFILE_TYPES.EQUILIBRADO,
      title: "Vida Equilibrada",
      description: "Equilíbrio entre presente e futuro.",
    });
  }
}

module.exports = { BalancedStrategy };
