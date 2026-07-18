/**
 * Store adaptativo para express-rate-limit.
 * Memoria (L1) por padrao; promove para Redis compartilhado quando disponivel.
 */
const { MemoryStore } = require("express-rate-limit");
const env = require("../config/env");
const logger = require("../utils/logger");
const sharedRedis = require("../platform/redis");

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
    this.redisStore = null;
    this.localKeys = new Set();
  }

  async init(options) {
    return this.memory.init?.(options);
  }

  getStore() {
    return this.redisStore || this.memory;
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

  async attachRedis(client) {
    if (!client || this.redisStore) return;
    try {
      const { RedisStore } = require("rate-limit-redis");
      this.redisStore = new RedisStore({
        sendCommand: (...args) => client.sendCommand(args),
        prefix: `finsight:rl:${this.prefix}:`,
      });
      logger.info("RateLimit store promoveu para Redis", { prefix: this.prefix });
    } catch (error) {
      logger.warn("RateLimit permanece em memoria", {
        prefix: this.prefix,
        error: error.message,
      });
    }
  }
}

let redisReady = false;
let promotePromise = null;

async function promoteAllToRedis() {
  if (!env.redisUrl) {
    logger.info("RateLimit em memoria (REDIS_URL ausente).");
    return { mode: "memory" };
  }
  if (redisReady) return { mode: "redis" };
  if (promotePromise) return promotePromise;

  promotePromise = (async () => {
    try {
      const client = await sharedRedis.connect();
      if (!client) {
        return { mode: "memory" };
      }
      redisReady = true;

      await Promise.all(
        [...bridges.values()].map((bridge) => bridge.attachRedis(client))
      );

      logger.info("RateLimit Redis compartilhado pronto.");
      return { mode: "redis" };
    } catch (error) {
      redisReady = false;
      logger.warn("RateLimit fallback memoria", { error: error.message });
      return { mode: "memory", error: error.message };
    } finally {
      promotePromise = null;
    }
  })();

  return promotePromise;
}

function getStatus() {
  return {
    mode: redisReady ? "redis" : "memory",
    redisReady,
    bridges: bridges.size,
  };
}

module.exports = {
  getBridge,
  promoteAllToRedis,
  getStatus,
  AdaptiveRateLimitStore,
};
