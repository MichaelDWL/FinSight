const accountsService = require("../../accounts/accounts.service");
const cardsService = require("../../cards/cards.service");
const usersService = require("../../users/users.service");
const CacheService = require("../cache/cache.service");
const { BFF_CACHE_TTL } = require("../bff.constants");
const { parallel } = require("../utils/parallel");

/**
 * AccountDetailBFFService — tela de detalhe da conta em 1 chamada.
 */
async function buildAccountDetail(userId, accountId) {
  const result = await parallel({
    user: () => usersService.getProfile(userId),
    accounts: () => accountsService.list(userId),
    cards: {
      fn: () => cardsService.list(userId),
      optional: true,
      fallback: [],
    },
  });

  const accounts = result.accounts || [];
  const resolvedId = accountId || accounts[0]?.id || null;
  const account = resolvedId
    ? await accountsService.detail(userId, resolvedId)
    : null;

  return {
    user: result.user,
    accounts,
    cards: result.cards || [],
    account,
  };
}

async function getAccountDetail(userId, accountId) {
  const variant = accountId || "default";
  const cacheKey = CacheService.buildKey("account-detail", userId, variant);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL["account-detail"],
    () => buildAccountDetail(userId, accountId || null),
  );
  return { data, cacheHit };
}

module.exports = { getAccountDetail, buildAccountDetail };
