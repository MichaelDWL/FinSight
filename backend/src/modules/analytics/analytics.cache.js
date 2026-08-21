const logger = require("../../utils/logger");

const DASHBOARDS = ["general", "expenses", "cashflow", "cards", "investments"];
const memoryStore = new Map();

let cacheMode = "memory";

function buildCacheKey(userId, dashboard, period) {
  const periodKey = `${period.period}:${period.startDate}:${period.endDate}`;
  return `analytics:${userId}:${dashboard}:${periodKey}`;
}

function buildUserPrefix(userId) {
  return `analytics:${userId}:`;
}

function isExpired(entry) {
  return !entry || Date.now() > entry.expiresAt;
}

async function initCache() {
  cacheMode = "memory";
  logger.info("Analytics cache em memoria.");
}

async function memoryGet(key) {
  const entry = memoryStore.get(key);
  if (isExpired(entry)) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

async function memorySet(key, value, ttlSeconds) {
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

async function memoryInvalidateUser(userId) {
  const prefix = buildUserPrefix(userId);
  let removed = 0;

  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key);
      removed += 1;
    }
  }

  return removed;
}

const cacheAdapter = {
  async get(key) {
    return memoryGet(key);
  },

  async set(key, value, ttlSeconds) {
    await memorySet(key, value, ttlSeconds);
  },

  async invalidateUser(userId) {
    return memoryInvalidateUser(userId);
  },

  getStatus() {
    return {
      mode: cacheMode,
      redisConnected: false,
      memoryEntries: memoryStore.size,
      dashboards: DASHBOARDS,
    };
  },
};

module.exports = {
  cacheAdapter,
  buildCacheKey,
  initCache,
  DASHBOARDS,
};
