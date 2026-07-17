/**
 * TTLs (segundos) por endpoint BFF.
 * Ajustaveis sem alterar controllers ou services de dominio.
 */
const BFF_CACHE_TTL = {
  home: 60,
  dashboard: 30,
  investments: 900, // 15 min — dados de mercado
  accounts: 45,
  cards: 45,
  transactions: 30,
  reports: 300, // 5 min
  insights: 60,
  "account-detail": 45,
  "card-detail": 45,
};

const BFF_ENDPOINTS = Object.keys(BFF_CACHE_TTL);

const BFF_CACHE_PREFIX = "bff";

module.exports = {
  BFF_CACHE_TTL,
  BFF_ENDPOINTS,
  BFF_CACHE_PREFIX,
};
