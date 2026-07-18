const logger = require("../../utils/logger");
const repository = require("./market.repository");
const { TTL } = require("./market.constants");
const { callProvider } = require("./providers/executor");
const { isSoftFailure } = require("./providers/errors");

/**
 * Indicadores economicos (SELIC, IPCA, FX) via MarketService/callProvider.
 * Nenhuma URL de API aqui — apenas orquestracao + cache PostgreSQL.
 */

function isFresh(lastUpdate, ttlMs) {
  if (!lastUpdate) return false;
  return Date.now() - new Date(lastUpdate).getTime() < ttlMs;
}

async function getCurrentRates() {
  const rates = await repository.getEconomicRates();
  return {
    ...(rates || {}),
    stale: !rates?.lastUpdate || !isFresh(rates.lastUpdate, TTL.SELIC_MS),
  };
}

async function refreshSelic({ force = false } = {}) {
  const current = await repository.getEconomicRates();
  if (!force && isFresh(current?.lastUpdate, TTL.SELIC_MS) && current?.selic != null) {
    return { skipped: true, reason: "ttl", rates: current, provider: "cache" };
  }

  try {
    const selic = await callProvider("bcb", "fetchSelic");
    await repository.insertEconomicHistory("SELIC", selic.value, selic.referenceDate);
    const rates = await repository.upsertEconomicRates({ selic: selic.value });
    await repository.syncLegacyIndicesFromRates(rates);
    return { skipped: false, rates, source: selic, provider: "bcb" };
  } catch (error) {
    if (isSoftFailure(error)) {
      logger.warn("Falha soft ao atualizar SELIC — usando cache", { error: error.message });
    } else {
      logger.error("Falha ao atualizar SELIC", { error: error.message });
    }
    return { skipped: false, failed: true, rates: current, error: error.message, provider: "cache" };
  }
}

async function refreshCdi({ force = false } = {}) {
  const current = await repository.getEconomicRates();
  if (!force && isFresh(current?.lastUpdate, TTL.CDI_MS) && current?.cdi != null) {
    return { skipped: true, reason: "ttl", rates: current, provider: "cache" };
  }

  try {
    const cdi = await callProvider("bcb", "fetchCdi");
    await repository.insertEconomicHistory("CDI", cdi.value, cdi.referenceDate);
    const rates = await repository.upsertEconomicRates({ cdi: cdi.value });
    await repository.syncLegacyIndicesFromRates(rates);
    return { skipped: false, rates, source: cdi, provider: "bcb" };
  } catch (error) {
    if (isSoftFailure(error)) {
      logger.warn("Falha soft ao atualizar CDI — usando cache", { error: error.message });
    } else {
      logger.error("Falha ao atualizar CDI", { error: error.message });
    }
    return { skipped: false, failed: true, rates: current, error: error.message, provider: "cache" };
  }
}

async function refreshIpca({ force = false } = {}) {
  const current = await repository.getEconomicRates();

  try {
    const ipca = await callProvider("bcb", "fetchIpca");
    const alreadyStored = await repository.hasEconomicHistory("IPCA", ipca.referenceDate);

    if (!force && alreadyStored) {
      return { skipped: true, reason: "ja_divulgado", rates: current, source: ipca, provider: "cache" };
    }

    await repository.insertEconomicHistory("IPCA", ipca.value, ipca.referenceDate);
    const rates = await repository.upsertEconomicRates({ ipca: ipca.value });
    await repository.syncLegacyIndicesFromRates(rates);
    return { skipped: false, rates, source: ipca, provider: "bcb" };
  } catch (error) {
    if (isSoftFailure(error)) {
      logger.warn("Falha soft ao atualizar IPCA — usando cache", { error: error.message });
    } else {
      logger.error("Falha ao atualizar IPCA", { error: error.message });
    }
    return { skipped: false, failed: true, rates: current, error: error.message, provider: "cache" };
  }
}

async function refreshFx({ force = false } = {}) {
  const current = await repository.getEconomicRates();
  if (!force && isFresh(current?.lastUpdate, TTL.FX_MS) && current?.dolar != null && current?.euro != null) {
    return { skipped: true, reason: "ttl", rates: current, provider: "cache" };
  }

  try {
    const [usd, eur] = await Promise.all([
      callProvider("bcb", "fetchUsd"),
      callProvider("bcb", "fetchEur"),
    ]);
    await repository.insertEconomicHistory("USD", usd.value, usd.referenceDate);
    await repository.insertEconomicHistory("EUR", eur.value, eur.referenceDate);
    const rates = await repository.upsertEconomicRates({
      dolar: usd.value,
      euro: eur.value,
    });
    return { skipped: false, rates, source: { usd, eur }, provider: "bcb" };
  } catch (error) {
    if (isSoftFailure(error)) {
      logger.warn("Falha soft ao atualizar cambio — usando cache", { error: error.message });
    } else {
      logger.error("Falha ao atualizar cambio", { error: error.message });
    }
    return { skipped: false, failed: true, rates: current, error: error.message, provider: "cache" };
  }
}

async function refreshDailyIndicators({ force = false } = {}) {
  const started = Date.now();
  const selic = await refreshSelic({ force });
  const cdi = await refreshCdi({ force });
  const fx = await refreshFx({ force });
  const ipca = await refreshIpca({ force: false });

  logger.info("Market rates sync", {
    provider: "bcb",
    status: "done",
    durationMs: Date.now() - started,
    selic: selic.failed ? "failed" : selic.skipped ? "skipped" : "ok",
    cdi: cdi.failed ? "failed" : cdi.skipped ? "skipped" : "ok",
    fx: fx.failed ? "failed" : fx.skipped ? "skipped" : "ok",
    ipca: ipca.failed ? "failed" : ipca.skipped ? "skipped" : "ok",
  });

  return {
    selic,
    cdi,
    fx,
    ipca,
    rates: await getCurrentRates(),
  };
}

async function getHistory(indicator, options) {
  return repository.getEconomicHistory(indicator, options);
}

module.exports = {
  getCurrentRates,
  getHistory,
  refreshCdi,
  refreshDailyIndicators,
  refreshFx,
  refreshIpca,
  refreshSelic,
};
