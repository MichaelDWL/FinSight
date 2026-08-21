/**
 * Store local para express-rate-limit.
 * Em ambiente serverless, o rate limit em memoria e por instancia.
 */
const { MemoryStore } = require("express-rate-limit");

const bridges = new Map();

function getBridge(prefix) {
  if (!bridges.has(prefix)) {
    bridges.set(prefix, new AdaptiveRateLimitStore(prefix));
  }
  return bridges.get(prefix);
}

class AdaptiveRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.memory = new MemoryStore();
    this.localKeys = new Set();
  }

  async init(options) {
    return this.memory.init?.(options);
  }

  getStore() {
    return this.memory;
  }

  async increment(key) {
    this.localKeys.add(key);
    return this.getStore().increment(key);
  }

  async decrement(key) {
    return this.getStore().decrement(key);
  }

  async resetKey(key) {
    return this.getStore().resetKey(key);
  }

  async resetAll() {
    if (typeof this.getStore().resetAll === "function") {
      return this.getStore().resetAll();
    }
    for (const key of this.localKeys) {
      await this.resetKey(key);
    }
    this.localKeys.clear();
  }

  async shutdown() {
    if (typeof this.getStore().shutdown === "function") {
      await this.getStore().shutdown();
    }
  }
}

function getStatus() {
  return {
    mode: "memory",
    redisReady: false,
    bridges: bridges.size,
  };
}

module.exports = {
  getBridge,
  getStatus,
  AdaptiveRateLimitStore,
};
