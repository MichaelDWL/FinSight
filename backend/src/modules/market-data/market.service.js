const logger = require("../../utils/logger");
const repository = require("./market.repository");
const { ttlForAssetType, PROVIDER_NAMES } = require("./market.constants");
const {
  getBreaker,
  getProviderChain,
  listProviders,
  resolveAssetClass,
} = require("./providers/registry");
const { toProviderError } = require("./providers/errors");
const { callProvider, recordProviderOutcome, withProviderFallback } = require("./providers/executor");
const { sleep } = require("./resilience/retry");

const REQUEST_GAP_MS = 250;

function isFresh(lastUpdate, ttlMs) {
  if (!lastUpdate) return false;
  return Date.now() - new Date(lastUpdate).getTime() < ttlMs;
}

function resolveCurrency(assetType, snapshotCurrency) {
  if (snapshotCurrency) return snapshotCurrency;
  if (assetType === "crypto" || assetType === "commodity") return "USD";
  return "BRL";
}

function computeVolatility(prices) {
  if (!prices || prices.length < 2) return null;
  const returns = [];
  for (let i = 1; i < prices.length; i += 1) {
    const prev = prices[i - 1];
    const curr = prices[i];
    if (prev > 0) returns.push((curr - prev) / prev);
  }
  if (!returns.length) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  return Number((Math.sqrt(variance) * 100).toFixed(4));
}

function defaultStooqSymbol(assetCode, assetType) {
  const code = String(assetCode || "").toUpperCase();
  const type = String(assetType || "").toLowerCase();

  if (code === "IBOV" || code === "^BVSP") return "^bvsp";
  if (code === "BTC" || code === "BTCUSD") return "btcusd";
  if (code === "ETH" || code === "ETHUSD") return "ethusd";
  if (code === "GOLD") return "xauusd";
  if (code === "WTI") return "cl.f";
  if (type === "crypto") return code.toLowerCase();
  if (type === "commodity") return code.toLowerCase();
  return `${code.toLowerCase()}.br`;
}

function inferWatchItem(assetCode, hints = {}) {
  const code = String(assetCode || "").toUpperCase().trim();
  if (!code) return null;

  const cryptoMap = {
    BTC: { assetType: "crypto", assetName: "Bitcoin" },
    BTCUSD: { assetType: "crypto", assetName: "Bitcoin" },
    ETH: { assetType: "crypto", assetName: "Ethereum" },
    ETHUSD: { assetType: "crypto", assetName: "Ethereum" },
  };

  if (cryptoMap[code]) {
    const item = { assetCode: code, ...cryptoMap[code], ...hints };
    item.symbols = {
      brapi: code.replace(/USD$/, ""),
      stooq: defaultStooqSymbol(code, item.assetType),
      ...(hints.symbols || {}),
    };
    item.stooqSymbol = item.symbols.stooq;
    return item;
  }

  if (code === "IBOV" || code === "^BVSP") {
    return {
      assetCode: "IBOV",
      assetName: hints.assetName || "Ibovespa",
      assetType: "index",
      stooqSymbol: "^bvsp",
      symbols: { brapi: "IBOV", stooq: "^bvsp", ...(hints.symbols || {}) },
    };
  }

  const type = hints.assetType || "stock";
  const symbols = {
    brapi: hints.brapiSymbol || hints.symbols?.brapi || code,
    stooq: hints.stooqSymbol || hints.symbols?.stooq || defaultStooqSymbol(code, type),
    ...(hints.symbols || {}),
  };

  return {
    assetCode: code,
    assetName: hints.assetName || code,
    assetType: type,
    stooqSymbol: symbols.stooq,
    symbols,
  };
}

function symbolForProvider(providerName, watchItem) {
  const symbols = watchItem.symbols || {};
  if (providerName === PROVIDER_NAMES.BRAPI) {
    return symbols.brapi || watchItem.assetCode;
  }
  if (providerName === PROVIDER_NAMES.STOOQ) {
    return symbols.stooq || watchItem.stooqSymbol || defaultStooqSymbol(watchItem.assetCode, watchItem.assetType);
  }
  return watchItem.assetCode;
}

async function listAssets(filters) {
  return repository.listMarketData(filters);
}

async function getAsset(assetCode) {
  const snapshot = await repository.getMarketDataByCode(assetCode);
  if (!snapshot) return null;

  const [history, stats] = await Promise.all([
    repository.getMarketHistory(assetCode, { limit: 365 }),
    repository.getMarketStats(assetCode),
  ]);

  const volatility = computeVolatility(history.map((item) => item.price));

  return {
    ...snapshot,
    history,
    stats: {
      ...stats,
      volatility,
    },
  };
}

async function getHistory(assetCode, options = {}) {
  const code = String(assetCode || "").toUpperCase().trim();
  if (!code) return [];
  return repository.getMarketHistory(code, options);
}

async function getOverview() {
  const [rates, assets] = await Promise.all([
    repository.getEconomicRates(),
    repository.listMarketData(),
  ]);

  return {
    rates: rates || null,
    assets,
    generatedAt: new Date().toISOString(),
  };
}

async function persistAssetSnapshot(watchItem, snapshot, providerName) {
  const asset = await repository.upsertMarketData({
    assetCode: watchItem.assetCode,
    assetName: snapshot.name || watchItem.assetName,
    assetType: watchItem.assetType,
    currentPrice: snapshot.price,
    currency: resolveCurrency(watchItem.assetType, snapshot.currency),
    dailyChange: snapshot.dailyChange,
    monthlyChange: snapshot.monthlyChange,
    yearlyChange: snapshot.yearlyChange,
    source: providerName,
    provider: providerName,
  });

  await repository.insertQuoteLog({
    assetCode: watchItem.assetCode,
    price: snapshot.price,
    currency: resolveCurrency(watchItem.assetType, snapshot.currency),
    provider: providerName,
    source: providerName,
    quoteDate: snapshot.date || new Date().toISOString().slice(0, 10),
    quoteTime: snapshot.time ? undefined : new Date().toISOString(),
  });

  const historyPoints = (snapshot.history || [])
    .filter((item) => item.date && (item.close != null || item.price != null))
    .map((item) => ({
      date: item.date,
      price: item.close ?? item.price,
      provider: providerName,
      source: providerName,
    }));

  if (historyPoints.length) {
    await repository.insertMarketHistoryBatch(watchItem.assetCode, historyPoints, {
      provider: providerName,
      source: providerName,
    });
  } else if (snapshot.date && snapshot.price != null) {
    await repository.insertMarketHistory(watchItem.assetCode, snapshot.price, snapshot.date, {
      provider: providerName,
      source: providerName,
    });
  }

  return asset;
}

async function refreshAsset(watchItem, { force = false } = {}) {
  const existing = await repository.getMarketDataByCode(watchItem.assetCode);
  const ttl = ttlForAssetType(watchItem.assetType);

  if (!force && existing && isFresh(existing.lastUpdate, ttl)) {
    logger.info("Market cache hit", {
      assetCode: watchItem.assetCode,
      provider: PROVIDER_NAMES.CACHE,
      status: "ttl",
      lastUpdate: existing.lastUpdate,
    });
    return { skipped: true, reason: "ttl", asset: existing, provider: PROVIDER_NAMES.CACHE };
  }

  const assetClass = resolveAssetClass(watchItem.assetType, watchItem.assetCode);
  const { data: snapshot, provider, errors } = await withProviderFallback(
    getProviderChain(assetClass),
    "getAsset",
    (providerName) => [symbolForProvider(providerName, watchItem)]
  );

  if (snapshot?.price != null && provider) {
    const asset = await persistAssetSnapshot(watchItem, snapshot, provider);
    logger.info("Market asset atualizado", {
      assetCode: watchItem.assetCode,
      provider,
      status: "updated",
      price: snapshot.price,
      fallbacksTried: errors.length,
    });
    return { skipped: false, asset, provider };
  }

  if (existing) {
    logger.warn("Market fallback para cache PostgreSQL", {
      assetCode: watchItem.assetCode,
      provider: PROVIDER_NAMES.CACHE,
      status: "stale_cache",
      errors,
    });
    return {
      skipped: false,
      failed: true,
      usedCache: true,
      asset: existing,
      provider: PROVIDER_NAMES.CACHE,
      error: errors.map((e) => `${e.provider}:${e.code || e.message}`).join(" | "),
    };
  }

  logger.warn("Market asset sem dados e sem cache", {
    assetCode: watchItem.assetCode,
    status: "unavailable",
    errors,
  });

  return {
    skipped: false,
    failed: true,
    asset: null,
    error: errors.map((e) => `${e.provider}:${e.code || e.message}`).join(" | ") || "indisponivel",
  };
}

async function ensureUserAssetsOnWatchlist() {
  const codes = await repository.listDistinctUserAssetCodes();
  const existing = await repository.listWatchlist({ activeOnly: false });
  const existingCodes = new Set(existing.map((item) => item.assetCode));
  let added = 0;

  for (const code of codes) {
    if (existingCodes.has(code)) continue;
    const inferred = inferWatchItem(code);
    if (!inferred) continue;
    // eslint-disable-next-line no-await-in-loop
    await repository.upsertWatchlistItem(inferred);
    added += 1;
  }

  return { added, totalUserAssets: codes.length };
}

async function refreshWatchlist({ force = false, types = null } = {}) {
  const syncStarted = Date.now();
  await ensureUserAssetsOnWatchlist();

  const watchlist = await repository.listWatchlist({ activeOnly: true });
  const filtered = types?.length
    ? watchlist.filter((item) => types.includes(item.assetType))
    : watchlist;

  const results = [];
  for (let i = 0; i < filtered.length; i += 1) {
    if (i > 0) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(REQUEST_GAP_MS);
    }
    // eslint-disable-next-line no-await-in-loop
    results.push(await refreshAsset(filtered[i], { force }));
  }

  const summary = {
    total: results.length,
    updated: results.filter((item) => !item.skipped && !item.failed).length,
    skipped: results.filter((item) => item.skipped).length,
    failed: results.filter((item) => item.failed).length,
    cachedFallback: results.filter((item) => item.usedCache).length,
    durationMs: Date.now() - syncStarted,
    lastSync: new Date().toISOString(),
    results,
  };

  logger.info("Market watchlist sync", {
    status: "done",
    total: summary.total,
    updated: summary.updated,
    skipped: summary.skipped,
    failed: summary.failed,
    cachedFallback: summary.cachedFallback,
    durationMs: summary.durationMs,
  });

  return summary;
}

async function ensureAssetInWatchlist(assetCode, hints = {}) {
  const code = String(assetCode || "").toUpperCase().trim();
  if (!code) return null;

  const inferred = inferWatchItem(code, hints);
  if (inferred) {
    await repository.upsertWatchlistItem(inferred);
    const refreshed = await refreshAsset(inferred, { force: false });
    if (refreshed.asset) return refreshed.asset;
  }

  return repository.getMarketDataByCode(code);
}

async function checkProvidersHealth() {
  const providers = listProviders();
  const results = [];

  for (const provider of providers) {
    const started = Date.now();
    const breaker = getBreaker(provider.name);
    try {
      // eslint-disable-next-line no-await-in-loop
      const health = await provider.healthCheck();
      const responseTimeMs = health.responseTimeMs ?? Date.now() - started;
      const online = health.status !== "offline";
      // eslint-disable-next-line no-await-in-loop
      await recordProviderOutcome(provider.name, {
        ok: online,
        error: online ? null : { message: health.error || "offline" },
        responseTimeMs,
      });
      if (online) breaker?.recordSuccess();
      else breaker?.recordFailure({ message: health.error });

      results.push({
        provider: provider.name,
        status: online ? "online" : "offline",
        responseTimeMs,
        lastSync: online ? new Date().toISOString() : null,
        lastError: online ? null : health.error || null,
        circuit: breaker?.snapshot()?.state || "closed",
      });
    } catch (error) {
      const wrapped = toProviderError(error, provider.name);
      const responseTimeMs = Date.now() - started;
      breaker?.recordFailure(wrapped);
      // eslint-disable-next-line no-await-in-loop
      await recordProviderOutcome(provider.name, { ok: false, error: wrapped, responseTimeMs });
      results.push({
        provider: provider.name,
        status: "offline",
        responseTimeMs,
        lastSync: null,
        lastError: wrapped.message,
        circuit: breaker?.snapshot()?.state || "open",
      });
    }
  }

  const stored = await repository.listProviderStatus();
  const byName = new Map(stored.map((row) => [row.provider, row]));

  return results.map((item) => {
    const db = byName.get(item.provider);
    return {
      provider: item.provider,
      status: item.status,
      responseTime: item.responseTimeMs ?? db?.responseTime ?? null,
      lastSuccess: db?.lastSuccess || item.lastSync,
      lastError: item.lastError || db?.lastError || null,
      updatedAt: db?.updatedAt || new Date().toISOString(),
      circuit: item.circuit,
    };
  });
}

async function getProvidersStatus() {
  const stored = await repository.listProviderStatus();
  if (stored.length) {
    return stored.map((row) => ({
      provider: row.provider,
      status: row.status,
      responseTime: row.responseTime,
      lastSuccess: row.lastSuccess,
      lastError: row.lastError,
      updatedAt: row.updatedAt,
      circuit: getBreaker(row.provider)?.snapshot()?.state || null,
    }));
  }
  return checkProvidersHealth();
}

module.exports = {
  callProvider,
  checkProvidersHealth,
  ensureAssetInWatchlist,
  ensureUserAssetsOnWatchlist,
  getAsset,
  getHistory,
  getOverview,
  getProvidersStatus,
  inferWatchItem,
  listAssets,
  refreshAsset,
  refreshWatchlist,
  withProviderFallback,
};
