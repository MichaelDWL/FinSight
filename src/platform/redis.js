/**
 * Cliente Redis compartilhado (singleton).
 * Usado por BFF cache, analytics cache, rate-limit e personalization.
 * Evita N conexoes por instancia serverless.
 */
const env = require("../config/env");
const logger = require("../utils/logger");

let client = null;
let connectPromise = null;
let ready = false;

function isReady() {
  return ready && client !== null;
}

function getClient() {
  return isReady() ? client : null;
}

async function connect() {
  if (!env.redisUrl) {
    return null;
  }
  if (isReady()) return client;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    try {
      const { createClient } = require("redis");
      const redis = createClient({
        url: env.redisUrl,
        socket: {
          connectTimeout: 5_000,
          reconnectStrategy: (retries) => {
            if (retries > 5) return false;
            return Math.min(retries * 200, 2_000);
          },
        },
      });

      redis.on("error", (error) => {
        logger.warn("Redis shared client error", { error: error.message });
        ready = false;
      });

      redis.on("end", () => {
        ready = false;
      });

      await redis.connect();
      client = redis;
      ready = true;
      logger.info("Redis shared client conectado.");
      return client;
    } catch (error) {
      client = null;
      ready = false;
      logger.warn("Redis shared client indisponivel", { error: error.message });
      return null;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

async function disconnect() {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    /* ignore */
  }
  client = null;
  ready = false;
}

module.exports = {
  connect,
  disconnect,
  getClient,
  isReady,
};
