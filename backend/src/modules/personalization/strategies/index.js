const { PROFILE_TYPES } = require("../constants");
const { BalancedStrategy } = require("./BalancedStrategy");
const { GrowthStrategy } = require("./GrowthStrategy");
const { LifestyleStrategy } = require("./LifestyleStrategy");
const { CustomStrategy } = require("./CustomStrategy");

const strategies = {
  [PROFILE_TYPES.EQUILIBRADO]: new BalancedStrategy(),
  [PROFILE_TYPES.CONQUISTADOR]: new GrowthStrategy(),
  [PROFILE_TYPES.APROVEITADOR]: new LifestyleStrategy(),
  [PROFILE_TYPES.CUSTOM]: new CustomStrategy(),
};

function resolveStrategy(profileType) {
  return strategies[profileType] || strategies[PROFILE_TYPES.EQUILIBRADO];
}

module.exports = { resolveStrategy, strategies };
