const accountsService = require("../../accounts/accounts.service");
const cardsService = require("../../cards/cards.service");
const usersService = require("../../users/users.service");
const CacheService = require("../cache/cache.service");
const { BFF_CACHE_TTL } = require("../bff.constants");
const { parallel } = require("../utils/parallel");

/**
 * CardDetailBFFService — tela de detalhe do cartao em 1 chamada.
 */
async function buildCardDetail(userId, cardId) {
  const result = await parallel({
    user: () => usersService.getProfile(userId),
    accounts: {
      fn: () => accountsService.list(userId),
      optional: true,
      fallback: [],
    },
    cards: () => cardsService.list(userId),
  });

  const cards = result.cards || [];
  const resolvedId = cardId || cards[0]?.id || null;
  const card = resolvedId ? await cardsService.detail(userId, resolvedId) : null;

  return {
    user: result.user,
    accounts: result.accounts || [],
    cards,
    card,
  };
}

async function getCardDetail(userId, cardId) {
  const variant = cardId || "default";
  const cacheKey = CacheService.buildKey("card-detail", userId, variant);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL["card-detail"],
    () => buildCardDetail(userId, cardId || null),
  );
  return { data, cacheHit };
}

module.exports = { getCardDetail, buildCardDetail };
