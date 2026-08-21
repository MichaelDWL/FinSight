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

  return removed;
}

module.exports = { get, set, invalidate };
