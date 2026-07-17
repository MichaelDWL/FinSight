const sharedRedis = require("../../../platform/redis");
const logger = require("../../../utils/logger");
const { CACHE_TTL_SECONDS } = require("../constants");

const memoryStore = new Map();
const PREFIX = "personalization";

function keyFor(userId, suffix = "context") {
  return `${PREFIX}:${userId}:${suffix}`;
}

function isExpired(entry) {
  return !entry || Date.now() > entry.expiresAt;
}

async function get(userId, suffix = "context") {
  const key = keyFor(userId, suffix);
  const client = sharedRedis.getClient();

  if (sharedRedis.isReady() && client) {
    try {
      const raw = await client.get(key);
      if (raw) return JSON.parse(raw);
    } catch (error) {
      logger.warn("Personalization Redis get falhou", { error: error.message });
    }
  }

  const entry = memoryStore.get(key);
  if (isExpired(entry)) {
    memoryStore.delete(key);
    return null;
  }
  return entry ? entry.value : null;
}

async function set(userId, value, suffix = "context", ttlSeconds = CACHE_TTL_SECONDS) {
  const key = keyFor(userId, suffix);
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  const client = sharedRedis.getClient();
  if (sharedRedis.isReady() && client) {
    try {
      await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (error) {
      logger.warn("Personalization Redis set falhou", { error: error.message });
    }
  }
}

async function invalidate(userId) {
  const prefix = `${PREFIX}:${userId}:`;
  let removed = 0;
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key);
      removed += 1;
    }
  }

  const client = sharedRedis.getClient();
  if (sharedRedis.isReady() && client) {
    let cursor = "0";
    try {
      do {
        const result = await client.scan(cursor, {
          MATCH: `${prefix}*`,
          COUNT: 50,
        });
        cursor = result.cursor;
        const keys = result.keys || [];
        if (keys.length) {
          await client.del(keys);
          removed += keys.length;
        }
      } while (cursor !== "0");
    } catch (error) {
      logger.warn("Personalization Redis invalidate falhou", { error: error.message });
    }
  }

  return removed;
}

module.exports = { get, set, invalidate };
