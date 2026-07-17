const PROJECTION_DISCLAIMER =
  "Esta e apenas uma projecao baseada nos indicadores economicos atuais. O rendimento real podera variar conforme mudancas do mercado.";

const DAY_MS = 24 * 60 * 60 * 1000;

const TTL = {
  SELIC_MS: DAY_MS,
  CDI_MS: DAY_MS,
  IPCA_MS: DAY_MS,
  FX_MS: DAY_MS,
  ASSETS_MS: DAY_MS,
  STOCK_MS: DAY_MS,
  FII_MS: DAY_MS,
  ETF_MS: DAY_MS,
  INDEX_MS: DAY_MS,
};

function ttlForAssetType(assetType) {
  const type = String(assetType || "").toLowerCase();
  if (type === "fii") return TTL.FII_MS;
  if (type === "etf") return TTL.ETF_MS;
  if (type === "index") return TTL.INDEX_MS;
  if (type === "stock") return TTL.STOCK_MS;
  return TTL.ASSETS_MS;
}

const BCB_SERIES = {
  SELIC: 432,
  CDI: 4389,
  IPCA: 433,
  USD: 1,
  EUR: 21619,
};

const FIXED_INCOME_TYPES = new Set([
  "tesouro_selic",
  "tesouro_ipca",
  "tesouro_prefixado",
  "cdb",
  "lci",
  "lca",
  "poupanca",
]);

const VARIABLE_INCOME_TYPES = new Set(["acoes", "fiis", "etfs", "criptomoedas"]);

const PROJECTION_HORIZONS_MONTHS = [3, 6, 12, 24, 60];

const SAVINGS_SELIC_THRESHOLD = 8.5;
const SAVINGS_FLAT_MONTHLY = 0.5;

const PROVIDER_NAMES = {
  BCB: "bcb",
  BRAPI: "brapi",
  STOOQ: "stooq",
  CACHE: "cache",
};

module.exports = {
  BCB_SERIES,
  FIXED_INCOME_TYPES,
  PROVIDER_NAMES,
  PROJECTION_DISCLAIMER,
  PROJECTION_HORIZONS_MONTHS,
  SAVINGS_FLAT_MONTHLY,
  SAVINGS_SELIC_THRESHOLD,
  TTL,
  VARIABLE_INCOME_TYPES,
  ttlForAssetType,
};
