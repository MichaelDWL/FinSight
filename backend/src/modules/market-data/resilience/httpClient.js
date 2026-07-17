const { ProviderError } = require("../providers/errors");

async function fetchWithTimeout(url, {
  timeoutMs = 12000,
  headers = {},
  method = "GET",
  body,
  provider = "unknown",
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
      redirect: "follow",
    });

    const text = await response.text();

    if (!response.ok) {
      throw new ProviderError(`HTTP ${response.status} em ${provider}`, {
        provider,
        code:
          response.status === 403
            ? "ACCESS_DENIED"
            : response.status === 401
              ? "UNAUTHORIZED"
              : response.status === 429
                ? "RATE_LIMITED"
                : "HTTP_ERROR",
        status: response.status,
        retryable: response.status === 429 || response.status >= 500,
        soft: true,
      });
    }

    return { response, text, status: response.status };
  } catch (error) {
    if (error instanceof ProviderError) throw error;

    const aborted = error?.name === "AbortError";
    throw new ProviderError(aborted ? `Timeout em ${provider}` : error.message || "Falha de rede", {
      provider,
      code: aborted ? "TIMEOUT" : error.code || "NETWORK_ERROR",
      status: null,
      retryable: true,
      soft: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}) {
  const { text, status } = await fetchWithTimeout(url, options);
  try {
    return { data: JSON.parse(text), status, text };
  } catch {
    throw new ProviderError(`Resposta JSON invalida de ${options.provider || "unknown"}`, {
      provider: options.provider,
      code: "INVALID_JSON",
      soft: true,
    });
  }
}

module.exports = { fetchJson, fetchWithTimeout };
