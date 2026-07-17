const env = require("../../config/env");
const logger = require("../../utils/logger");
const sharedRedis = require("../../platform/redis");

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

function redisClient() {
  return sharedRedis.getClient();
}

function redisReady() {
  return sharedRedis.isReady();
}

async function initCache() {
  if (!env.redisUrl) {
    cacheMode = "memory";
    logger.info("Analytics cache em memoria (REDIS_URL nao configurado).");
    return;
  }

  const client = await sharedRedis.connect();
  if (client) {
    cacheMode = "redis";
    logger.info("Analytics cache usando Redis compartilhado.");
  } else {
    cacheMode = "memory";
    logger.warn("Falha ao conectar Redis, usando cache em memoria.");
  }
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

async function redisGet(key) {
  const client = redisClient();
  if (!redisReady() || !client) return null;

  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    logger.warn("Falha ao ler cache Redis.", { error: error.message, key });
    return null;
  }
}

async function redisSet(key, value, ttlSeconds) {
  const client = redisClient();
  if (!redisReady() || !client) return;

  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    logger.warn("Falha ao gravar cache Redis.", { error: error.message, key });
  }
}

async function redisInvalidateUser(userId) {
  const client = redisClient();
  if (!redisReady() || !client) return 0;

  const prefix = buildUserPrefix(userId);
  let removed = 0;
  let cursor = "0";

  try {
    do {
      const result = await client.scan(cursor, {
        MATCH: `${prefix}*`,
        COUNT: 100,
      });

      cursor = result.cursor;
      const keys = result.keys || [];

      if (keys.length) {
        await client.del(keys);
        removed += keys.length;
      }
    } while (cursor !== "0");
  } catch (error) {
    logger.warn("Falha ao invalidar cache Redis.", { error: error.message, userId });
  }

  return removed;
}

const cacheAdapter = {
  async get(key) {
    if (cacheMode === "redis") {
      const value = await redisGet(key);
      if (value !== null) return value;
    }

    return memoryGet(key);
  },

  async set(key, value, ttlSeconds) {
    await memorySet(key, value, ttlSeconds);

    if (cacheMode === "redis") {
      await redisSet(key, value, ttlSeconds);
    }
  },

  async invalidateUser(userId) {
    const memoryRemoved = await memoryInvalidateUser(userId);
    const redisRemoved = await redisInvalidateUser(userId);
    return memoryRemoved + redisRemoved;
  },

  getStatus() {
    return {
      mode: cacheMode,
      redisConnected: redisReady(),
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
