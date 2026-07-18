class CircuitBreaker {
  constructor({
    name,
    failureThreshold = 5,
    cooldownMs = 60_000,
    halfOpenMax = 1,
  } = {}) {
    this.name = name || "default";
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.halfOpenMax = halfOpenMax;
    this.failures = 0;
    this.state = "closed";
    this.openedAt = null;
    this.halfOpenInFlight = 0;
    this.lastError = null;
  }

  canRequest() {
    if (this.state === "closed") return true;

    if (this.state === "open") {
      if (Date.now() - (this.openedAt || 0) >= this.cooldownMs) {
        this.state = "half-open";
        this.halfOpenInFlight = 0;
        return true;
      }
      return false;
    }

    if (this.state === "half-open") {
      if (this.halfOpenInFlight < this.halfOpenMax) {
        this.halfOpenInFlight += 1;
        return true;
      }
      return false;
    }

    return true;
  }

  recordSuccess() {
    this.failures = 0;
    this.state = "closed";
    this.openedAt = null;
    this.halfOpenInFlight = 0;
    this.lastError = null;
  }

  recordFailure(error) {
    this.failures += 1;
    this.lastError = error?.message || String(error);
    this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);

    if (this.state === "half-open" || this.failures >= this.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }

  snapshot() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      openedAt: this.openedAt,
      lastError: this.lastError,
    };
  }
}

module.exports = { CircuitBreaker };
