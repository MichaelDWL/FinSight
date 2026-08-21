const logger = require("../../../utils/logger");
const { BFF_CACHE_PREFIX } = require("../bff.constants");

/**
 * CacheService — camada compartilhada em memoria.
 * Controllers NUNCA devem chamar este servico diretamente.
 * Em serverless, este cache e local por instancia e descartavel.
 */
const memoryStore = new Map();
/** Coalesce concurrent MISS na mesma key (evita thundering herd com pool max=2). */
const inflightWrap = new Map();

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
  cacheMode = "memory";
  logger.info("BFF CacheService em memoria.");
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

async function get(key) {
  return memoryGet(key);
}

async function set(key, value, ttlSeconds) {
  await memorySet(key, value, ttlSeconds);
}

async function del(key) {
  await memoryDel(key);
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

  return removed;
}

async function wrap(key, ttlSeconds, factory) {
  const cached = await get(key);
  if (cached !== null && cached !== undefined) {
    return { data: cached, cacheHit: true };
  }

  let pending = inflightWrap.get(key);
  const isLeader = !pending;
  if (!pending) {
    pending = Promise.resolve()
      .then(factory)
      .then(async (data) => {
        if (ttlSeconds > 0 && data !== null && data !== undefined) {
          await set(key, data, ttlSeconds);
        }
        return data;
      })
      .finally(() => {
        inflightWrap.delete(key);
      });
    inflightWrap.set(key, pending);
  }

  const data = await pending;
  return { data, cacheHit: !isLeader };
}

function getStatus() {
  return {
    mode: cacheMode,
      redisConnected: false,
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
    return memoryInvalidatePrefix(prefix);
  },
  buildKey,
  getStatus,
};

module.exports = CacheService;
