const { cacheAdapter } = require("./analytics.cache");
const { invalidateUserBff } = require("../bff/bff.invalidation");

async function invalidateUserAnalytics(userId) {
  if (!userId) return 0;
  const [analyticsRemoved, bffRemoved] = await Promise.all([
    cacheAdapter.invalidateUser(userId),
    invalidateUserBff(userId),
  ]);
  return analyticsRemoved + bffRemoved;
}

module.exports = { invalidateUserAnalytics };
