const env = require("../../../config/env");
const logger = require("../../../utils/logger");
const sharedRedis = require("../../../platform/redis");
const { BFF_CACHE_PREFIX } = require("../bff.constants");

/**
 * CacheService — camada compartilhada (memoria + Redis).
 * Controllers NUNCA devem chamar este servico diretamente.
 * Compativel com Redis, Railway, Docker, Fly.io, Coolify, K8s.
 */
const memoryStore = new Map();

let cacheMode = "memory";
let initialized = false;

function buildKey(endpoint, userId, variant = "default") {
  return `${BFF_CACHE_PREFIX}:${endpoint}:${userId}:${variant}`;
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

async function init() {
  if (initialized) return getStatus();
  initialized = true;

  if (!env.redisUrl) {
    cacheMode = "memory";
    logger.info("BFF CacheService em memoria (REDIS_URL nao configurado).");
    return getStatus();
  }

  const client = await sharedRedis.connect();
  if (client) {
    cacheMode = "redis";
    logger.info("BFF CacheService usando Redis compartilhado.");
  } else {
    cacheMode = "memory";
    logger.warn("BFF falha Redis, usando memoria.");
  }

  return getStatus();
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

async function memoryDel(key) {
  return memoryStore.delete(key);
}

async function memoryInvalidatePrefix(prefix) {
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
    logger.warn("BFF cache Redis get falhou.", { error: error.message, key });
    return null;
  }
}

async function redisSet(key, value, ttlSeconds) {
  const client = redisClient();
  if (!redisReady() || !client) return;
  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    logger.warn("BFF cache Redis set falhou.", { error: error.message, key });
  }
}

async function redisDel(key) {
  const client = redisClient();
  if (!redisReady() || !client) return;
  try {
    await client.del(key);
  } catch (error) {
    logger.warn("BFF cache Redis del falhou.", { error: error.message, key });
  }
}

async function redisInvalidatePrefix(prefix) {
  const client = redisClient();
  if (!redisReady() || !client) return 0;

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
    logger.warn("BFF cache Redis invalidate falhou.", { error: error.message, prefix });
  }

  return removed;
}

async function get(key) {
  if (cacheMode === "redis") {
    const value = await redisGet(key);
    if (value !== null) return value;
  }
  return memoryGet(key);
}

async function set(key, value, ttlSeconds) {
  await memorySet(key, value, ttlSeconds);
  if (cacheMode === "redis") {
    await redisSet(key, value, ttlSeconds);
  }
}

async function del(key) {
  await memoryDel(key);
  await redisDel(key);
}

async function invalidateUser(userId) {
  if (!userId) return 0;
  const prefix = `${BFF_CACHE_PREFIX}:`;
  const userToken = `:${userId}:`;
  let removed = 0;

  for (const key of [...memoryStore.keys()]) {
    if (key.startsWith(prefix) && key.includes(userToken)) {
      memoryStore.delete(key);
      removed += 1;
    }
  }

  const client = redisClient();
  if (redisReady() && client) {
    let cursor = "0";
    try {
      do {
        const result = await client.scan(cursor, {
          MATCH: `${BFF_CACHE_PREFIX}:*`,
          COUNT: 100,
        });
        cursor = result.cursor;
        const keys = (result.keys || []).filter((key) => key.includes(userToken));
        if (keys.length) {
          await client.del(keys);
          removed += keys.length;
        }
      } while (cursor !== "0");
    } catch (error) {
      logger.warn("BFF invalidateUser Redis falhou.", { error: error.message, userId });
    }
  }

  return removed;
}

async function wrap(key, ttlSeconds, factory) {
  const cached = await get(key);
  if (cached !== null && cached !== undefined) {
    return { data: cached, cacheHit: true };
  }

  const data = await factory();
  if (ttlSeconds > 0 && data !== null && data !== undefined) {
    await set(key, data, ttlSeconds);
  }

  return { data, cacheHit: false };
}

function getStatus() {
  return {
    mode: cacheMode,
    redisConnected: redisReady(),
    memoryEntries: memoryStore.size,
    initialized,
  };
}

const CacheService = {
  init,
  get,
  set,
  del,
  wrap,
  invalidateUser,
  invalidatePrefix: async (prefix) => {
    const memoryRemoved = await memoryInvalidatePrefix(prefix);
    const redisRemoved = await redisInvalidatePrefix(prefix);
    return memoryRemoved + redisRemoved;
  },
  buildKey,
  getStatus,
};

module.exports = CacheService;
