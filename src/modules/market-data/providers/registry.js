const bcb = require("./bcb.provider");
const brapi = require("./brapi.provider");
const stooq = require("./stooq.provider");
const { CircuitBreaker } = require("../resilience/circuitBreaker");

const providers = new Map();
const breakers = new Map();

function register(provider) {
  providers.set(provider.name, provider);
  if (!breakers.has(provider.name)) {
    breakers.set(
      provider.name,
      new CircuitBreaker({
        name: provider.name,
        failureThreshold: provider.name === "stooq" ? 3 : 5,
        cooldownMs: provider.name === "stooq" ? 5 * 60_000 : 60_000,
      })
    );
  }
}

register(bcb);
register(brapi);
register(stooq);

function getProvider(name) {
  return providers.get(name) || null;
}

function getBreaker(name) {
  return breakers.get(name) || null;
}

function listProviders() {
  return [...providers.values()];
}

/**
 * Cadeias de fallback por classe de ativo.
 * Novos providers internacionais entram aqui sem tocar regras de negocio.
 */
const PROVIDER_CHAINS = {
  equity_br: ["brapi", "stooq"],
  equity_intl: ["stooq"],
  crypto: ["stooq"],
  commodity: ["stooq"],
  economic: ["bcb"],
};

function resolveAssetClass(assetType, assetCode) {
  const type = String(assetType || "").toLowerCase();
  const code = String(assetCode || "").toUpperCase();

  if (type === "crypto") return "crypto";
  if (type === "commodity") return "commodity";
  if (type === "fx" || type === "economic") return "economic";

  if (["stock", "etf", "fii", "index"].includes(type)) {
    if (code.endsWith(".US") || code.includes(":")) return "equity_intl";
    return "equity_br";
  }

  // Heuristica: tickers B3 tipicos (PETR4, BOVA11, HGLG11, IBOV)
  if (/^[A-Z]{4}\d{1,2}$/.test(code) || code === "IBOV" || code.endsWith("11")) {
    return "equity_br";
  }

  return "equity_br";
}

function getProviderChain(assetClass) {
  return PROVIDER_CHAINS[assetClass] || PROVIDER_CHAINS.equity_br;
}

module.exports = {
  PROVIDER_CHAINS,
  getBreaker,
  getProvider,
  getProviderChain,
  listProviders,
  register,
  resolveAssetClass,
};
