const env = require("../../../config/env");
const logger = require("../../../utils/logger");
const { BFF_CACHE_PREFIX } = require("../bff.constants");

/**
 * CacheService — camada compartilhada (memoria + Redis).
 * Controllers NUNCA devem chamar este servico diretamente.
 * Compativel com Redis, Railway, Docker, Fly.io, Coolify, K8s.
 */
const memoryStore = new Map();

let redisClient = null;
let redisReady = false;
let cacheMode = "memory";
let initialized = false;

function buildKey(endpoint, userId, variant = "default") {
  return `${BFF_CACHE_PREFIX}:${endpoint}:${userId}:${variant}`;
}

function isExpired(entry) {
  return !entry || Date.now() > entry.expiresAt;
}

async function init() {
  if (initialized) return getStatus();
  initialized = true;

  if (!env.redisUrl) {
    cacheMode = "memory";
    logger.info("BFF CacheService em memoria (REDIS_URL nao configurado).");
    return getStatus();
  }

  try {
    const { createClient } = require("redis");
    redisClient = createClient({ url: env.redisUrl });

    redisClient.on("error", (error) => {
      logger.warn("BFF Redis indisponivel, fallback memoria.", { error: error.message });
      redisReady = false;
      cacheMode = "memory";
    });

    await redisClient.connect();
    redisReady = true;
    cacheMode = "redis";
    logger.info("BFF CacheService conectado ao Redis.");
  } catch (error) {
    redisClient = null;
    redisReady = false;
    cacheMode = "memory";
    logger.warn("BFF falha Redis, usando memoria.", { error: error.message });
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
  if (!redisReady || !redisClient) return null;
  try {
    const raw = await redisClient.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    logger.warn("BFF cache Redis get falhou.", { error: error.message, key });
    return null;
  }
}

async function redisSet(key, value, ttlSeconds) {
  if (!redisReady || !redisClient) return;
  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    logger.warn("BFF cache Redis set falhou.", { error: error.message, key });
  }
}

async function redisDel(key) {
  if (!redisReady || !redisClient) return;
  try {
    await redisClient.del(key);
  } catch (error) {
    logger.warn("BFF cache Redis del falhou.", { error: error.message, key });
  }
}

async function redisInvalidatePrefix(prefix) {
  if (!redisReady || !redisClient) return 0;

  let removed = 0;
  let cursor = "0";

  try {
    do {
      const result = await redisClient.scan(cursor, {
        MATCH: `${prefix}*`,
        COUNT: 100,
      });
      cursor = result.cursor;
      const keys = result.keys || [];
      if (keys.length) {
        await redisClient.del(keys);
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
  // Invalida todas as chaves bff:*:userId:*
  const userToken = `:${userId}:`;
  let removed = 0;

  for (const key of [...memoryStore.keys()]) {
    if (key.startsWith(prefix) && key.includes(userToken)) {
      memoryStore.delete(key);
      removed += 1;
    }
  }

  if (redisReady && redisClient) {
    let cursor = "0";
    try {
      do {
        const result = await redisClient.scan(cursor, {
          MATCH: `${BFF_CACHE_PREFIX}:*`,
          COUNT: 100,
        });
        cursor = result.cursor;
        const keys = (result.keys || []).filter((key) => key.includes(userToken));
        if (keys.length) {
          await redisClient.del(keys);
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
    redisConnected: redisReady,
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
