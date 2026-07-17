const cardsService = require("../../cards/cards.service");
const invoicesService = require("../../invoices/invoices.service");
const analyticsService = require("../../analytics/analytics.service");
const usersService = require("../../users/users.service");
const CacheService = require("../cache/cache.service");
const { BFF_CACHE_TTL } = require("../bff.constants");
const { parallel } = require("../utils/parallel");

/**
 * CardsBFFService — tela de cartoes em uma chamada.
 */
async function buildCards(userId, query = {}) {
  const result = await parallel({
    user: () => usersService.getProfile(userId),
    cards: () => cardsService.list(userId),
    invoices: {
      fn: () => invoicesService.listCurrent(userId),
      optional: true,
      fallback: [],
    },
    analytics: {
      fn: () => analyticsService.getCards(userId, query),
      optional: true,
      fallback: null,
    },
  });

  const cards = result.cards || [];
  const invoices = result.invoices || [];
  const analytics = result.analytics || {};

  const totalLimit = cards.reduce((sum, card) => sum + Number(card.totalLimit || 0), 0);
  const usedLimit = cards.reduce((sum, card) => sum + Number(card.usedLimit || 0), 0);
  const utilization = totalLimit > 0 ? Math.round((usedLimit / totalLimit) * 100) : 0;

  const alerts = [];
  for (const card of cards) {
    const limit = Number(card.totalLimit || 0);
    const used = Number(card.usedLimit || 0);
    if (limit > 0 && used / limit >= 0.8) {
      alerts.push({
        type: "limit",
        tone: used / limit >= 0.95 ? "warning" : "neutral",
        cardId: card.id,
        message: `${card.name} utilizou ${Math.round((used / limit) * 100)}% do limite.`,
      });
    }
  }

  const installments = invoices.flatMap((invoice) => invoice.installments || invoice.items || []);

  return {
    user: result.user,
    cards,
    limits: {
      total: Math.round(totalLimit * 100) / 100,
      used: Math.round(usedLimit * 100) / 100,
      available: Math.round((totalLimit - usedLimit) * 100) / 100,
      utilization,
    },
    invoices,
    installments,
    summary: {
      cardCount: cards.length,
      invoiceCount: invoices.length,
      utilization,
      analyticsSummary: analytics.summary || analytics.kpis || null,
    },
    utilization: {
      percent: utilization,
      byCard: cards.map((card) => {
        const limit = Number(card.totalLimit || 0);
        const used = Number(card.usedLimit || 0);
        return {
          id: card.id,
          name: card.name,
          percent: limit > 0 ? Math.round((used / limit) * 100) : 0,
          used,
          limit,
        };
      }),
    },
    alerts: [...alerts, ...(analytics.alerts || [])],
    chart: analytics.charts || analytics.chart || null,
    analytics,
  };
}

async function getCards(userId, query = {}) {
  const period = query.period || "30d";
  const cacheKey = CacheService.buildKey("cards", userId, period);
  const { data, cacheHit } = await CacheService.wrap(
    cacheKey,
    BFF_CACHE_TTL.cards,
    () => buildCards(userId, query),
  );

  return { data, cacheHit };
}

module.exports = { getCards, buildCards };
