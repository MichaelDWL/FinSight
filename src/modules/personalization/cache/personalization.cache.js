const memoryStore = new Map();
const { CACHE_TTL_SECONDS } = require("../constants");

function keyFor(userId, suffix = "context") {
  return `personalization:${userId}:${suffix}`;
}

function isExpired(entry) {
  return !entry || Date.now() > entry.expiresAt;
}

async function get(userId, suffix = "context") {
  const entry = memoryStore.get(keyFor(userId, suffix));
  if (isExpired(entry)) {
    memoryStore.delete(keyFor(userId, suffix));
    return null;
  }
  return entry.value;
}

async function set(userId, value, suffix = "context", ttlSeconds = CACHE_TTL_SECONDS) {
  memoryStore.set(keyFor(userId, suffix), {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

async function invalidate(userId) {
  const prefix = `personalization:${userId}:`;
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
