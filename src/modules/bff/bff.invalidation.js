const CacheService = require("./cache/cache.service");

function invalidateUserBff(userId) {
  if (!userId) return Promise.resolve(0);
  return CacheService.invalidateUser(userId);
}

module.exports = { invalidateUserBff };
