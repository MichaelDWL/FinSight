function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry com exponential backoff + jitter.
 */
async function withRetry(fn, {
  retries = 2,
  baseDelayMs = 300,
  maxDelayMs = 4000,
  shouldRetry = () => true,
} = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const isLast = attempt >= retries;
      if (isLast || !shouldRetry(error, attempt)) {
        throw error;
      }
      const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * Math.min(200, exp * 0.2));
      await sleep(exp + jitter);
    }
  }

  throw lastError;
}

module.exports = { sleep, withRetry };
