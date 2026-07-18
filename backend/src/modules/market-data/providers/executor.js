const logger = require("../../../utils/logger");
const repository = require("../market.repository");
const { getBreaker, getProvider } = require("./registry");
const { isSoftFailure, toProviderError } = require("./errors");

async function recordProviderOutcome(providerName, { ok, error, responseTimeMs }) {
  const now = new Date();
  try {
    await repository.upsertProviderStatus({
      provider: providerName,
      status: ok ? "online" : "offline",
      lastSuccess: ok ? now.toISOString() : null,
      lastError: ok ? null : error?.message || String(error),
      responseTime: responseTimeMs ?? null,
    });
  } catch (persistError) {
    logger.warn("Falha ao persistir status do provider", {
      provider: providerName,
      error: persistError.message,
    });
  }
}

/**
 * Executa um metodo do provider com circuit breaker + telemetria.
 * Camada unica de acesso — MarketService e rate.service usam apenas isto.
 */
async function callProvider(providerName, method, ...args) {
  const provider = getProvider(providerName);
  if (!provider) {
    throw toProviderError(new Error(`Provider desconhecido: ${providerName}`), providerName);
  }

  if (typeof provider[method] !== "function") {
    throw toProviderError(
      new Error(`Metodo ${method} indisponivel em ${providerName}`),
      providerName
    );
  }

  const breaker = getBreaker(providerName);
  if (breaker && !breaker.canRequest()) {
    const err = toProviderError(
      new Error(`Circuit breaker aberto para ${providerName}`),
      providerName
    );
    err.code = "CIRCUIT_OPEN";
    err.soft = true;
    throw err;
  }

  const started = Date.now();
  try {
    const result = await provider[method](...args);
    const responseTimeMs = Date.now() - started;
    breaker?.recordSuccess();
    await recordProviderOutcome(providerName, { ok: true, responseTimeMs });
    logger.info("Market provider OK", {
      provider: providerName,
      method,
      status: "ok",
      responseTimeMs,
    });
    return result;
  } catch (error) {
    const wrapped = toProviderError(error, providerName);
    const responseTimeMs = Date.now() - started;
    breaker?.recordFailure(wrapped);
    await recordProviderOutcome(providerName, { ok: false, error: wrapped, responseTimeMs });

    if (isSoftFailure(wrapped)) {
      logger.warn("Market provider soft-fail", {
        provider: providerName,
        method,
        status: "soft_fail",
        code: wrapped.code,
        httpStatus: wrapped.status,
        responseTimeMs,
        error: wrapped.message,
      });
    } else {
      logger.error("Market provider hard-fail", {
        provider: providerName,
        method,
        status: "error",
        code: wrapped.code,
        responseTimeMs,
        error: wrapped.message,
      });
    }

    throw wrapped;
  }
}

/**
 * Cadeia de fallback: tenta providers em ordem; falhas soft seguem adiante.
 */
async function withProviderFallback(chain, method, resolveArgs) {
  const errors = [];

  for (const providerName of chain) {
    try {
      const args = typeof resolveArgs === "function" ? resolveArgs(providerName) : resolveArgs;
      const data = await callProvider(providerName, method, ...args);
      return { data, provider: providerName, errors };
    } catch (error) {
      errors.push({ provider: providerName, code: error.code, message: error.message });
      if (!isSoftFailure(error)) break;
    }
  }

  return { data: null, provider: null, errors };
}

module.exports = {
  callProvider,
  recordProviderOutcome,
  withProviderFallback,
};
