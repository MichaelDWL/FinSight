const dotenv = require("dotenv");

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === "true",
  dbPoolMax: Number(process.env.DB_POOL_MAX) || 10,
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 300,
  redisUrl: process.env.REDIS_URL || null,
  redisEnabled: Boolean(process.env.REDIS_URL),
  marketSchedulerEnabled: process.env.MARKET_SCHEDULER_ENABLED !== "false",
  brapiToken: process.env.BRAPI_TOKEN || null,
};

module.exports = env;
