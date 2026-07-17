class ProviderError extends Error {
  constructor(message, { provider, code, status, retryable = false, soft = true } = {}) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider || null;
    this.code = code || "PROVIDER_ERROR";
    this.status = status ?? null;
    this.retryable = Boolean(retryable);
    this.soft = soft !== false;
  }
}

const SOFT_STATUS_CODES = new Set([401, 403, 408, 429, 500, 502, 503, 504]);

const SOFT_ERROR_PATTERNS = [
  /timeout/i,
  /aborted/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /EAI_AGAIN/i,
  /CERT_|SSL|TLS/i,
  /fetch failed/i,
  /network/i,
  /socket/i,
  /Access Denied/i,
  /Access denied/i,
];

function isSoftFailure(error) {
  if (!error) return false;
  if (error instanceof ProviderError) return error.soft;
  if (error.status && SOFT_STATUS_CODES.has(Number(error.status))) return true;
  const message = String(error.message || error.code || "");
  return SOFT_ERROR_PATTERNS.some((pattern) => pattern.test(message) || pattern.test(String(error.code || "")));
}

function toProviderError(error, provider) {
  if (error instanceof ProviderError) {
    if (!error.provider) error.provider = provider;
    return error;
  }

  const status = error.status ?? error.statusCode ?? null;
  const code =
    status === 403
      ? "ACCESS_DENIED"
      : status === 401
        ? "UNAUTHORIZED"
        : status === 429
          ? "RATE_LIMITED"
          : error.code || "PROVIDER_ERROR";

  return new ProviderError(error.message || "Falha no provedor de mercado", {
    provider,
    code,
    status,
    retryable: status === 429 || status === 408 || status >= 500,
    soft: isSoftFailure(error),
  });
}

module.exports = {
  ProviderError,
  SOFT_STATUS_CODES,
  isSoftFailure,
  toProviderError,
};
