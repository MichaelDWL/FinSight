const accountsService = require("../../accounts/accounts.service");
const cardsService = require("../../cards/cards.service");
const CacheService = require("../cache/cache.service");
const { BFF_CACHE_TTL } = require("../bff.constants");
const { parallel } = require("../utils/parallel");
const { resolveUser } = require("../utils/resolveUser");

/**
 * AccountDetailBFFService — tela de detalhe da conta em 1 chamada.
 * Shell usa listSummary (sem CTE de movimentacoes); detalhe traz stats + historico.
 */
async function buildAccountDetail(userId, accountId, options = {}) {
  const result = await parallel({
    user: () => resolveUser(userId, options),
    accounts: () => accountsService.listSummary(userId),
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

async function getAccountDetail(userId, accountId, options = {}) {
  const variant = accountId || "default";
  const cacheKey = CacheService.buildKey("account-detail", userId, variant);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL["account-detail"],
    () => buildAccountDetail(userId, accountId || null, options),
  );
  return { data, cacheHit };
}

module.exports = { getAccountDetail, buildAccountDetail };
