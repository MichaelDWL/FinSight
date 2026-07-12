const { cacheAdapter } = require("./analytics.cache");

function invalidateUserAnalytics(userId) {
  if (!userId) return Promise.resolve(0);
  return cacheAdapter.invalidateUser(userId);
}

module.exports = { invalidateUserAnalytics };
