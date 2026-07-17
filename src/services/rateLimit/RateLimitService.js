const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const slowDown = require("express-slow-down");
const env = require("../../config/env");
const rateLimitConfig = require("../../config/rateLimit.config");
const logger = require("../../utils/logger");
const { getBridge, getStatus } = require("../../middlewares/rateLimit/store");
const AppError = require("../../utils/AppError");

/**
 * RateLimitService — fabrica centralizada de limiters.
 * Suporta chave por IP, usuario, endpoint e metodo.
 */
class RateLimitService {
  constructor(config = rateLimitConfig) {
    this.config = config;
    this._cache = new Map();
    this._warnedNoRedis = false;
  }

  assertStorePolicy() {
    if (!this.config.requireRedisInProduction) return;
    if (!env.isProduction) return;
    if (env.redisUrl) return;
    if (this._warnedNoRedis) return;
    this._warnedNoRedis = true;
    logger.error(
      "RateLimit em PRODUCAO sem REDIS_URL — memoria por instancia e ineficaz contra abuso. Configure REDIS_URL."
    );
  }

  /**
   * Gera chave: ip | user | endpoint | method
   * Usa ipKeyGenerator para normalizar IPv6 (exigencia express-rate-limit).
   */
  buildKeyGenerator({ keyBy = "ip", group = "api" } = {}) {
    return (req, res) => {
      const ipKey = ipKeyGenerator(req.ip || req.socket?.remoteAddress || "unknown");
      const userId = req.user?.id || "anon";
      const method = req.method || "GET";
      const path = (req.baseUrl || "") + (req.path || req.route?.path || "");

      switch (keyBy) {
        case "user":
          return `${group}:user:${userId}:ip:${ipKey}`;
        case "endpoint":
          return `${group}:ep:${method}:${path}:ip:${ipKey}`;
        case "method":
          return `${group}:method:${method}:ip:${ipKey}`;
        case "ip":
        default:
          return `${group}:ip:${ipKey}`;
      }
    };
  }

  createLimiter({
    group,
    windowMs,
    max,
    message,
    keyBy = "ip",
    methods = null,
  }) {
    this.assertStorePolicy();

    const cacheKey = `${group}:${windowMs}:${max}:${keyBy}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const limiter = rateLimit({
      windowMs,
      max,
      standardHeaders: "draft-7",
      legacyHeaders: true,
      store: getBridge(group),
      keyGenerator: this.buildKeyGenerator({ keyBy, group }),
      validate: {
        keyGeneratorIpFallback: false,
      },
      skip: (req) => {
        if (!methods || !methods.length) return false;
        return !methods.includes(req.method);
      },
      handler: (req, res, _next, options) => {
        const resetTime = req.rateLimit?.resetTime;
        const retryAfterSec = resetTime
          ? Math.max(1, Math.ceil((new Date(resetTime).getTime() - Date.now()) / 1000))
          : Math.ceil(windowMs / 1000);

        res.setHeader("Retry-After", String(retryAfterSec));
        if (req.rateLimit?.limit != null) {
          res.setHeader("X-RateLimit-Limit", String(req.rateLimit.limit));
        }
        if (req.rateLimit?.remaining != null) {
          res.setHeader("X-RateLimit-Remaining", String(req.rateLimit.remaining));
        }
        if (resetTime) {
          res.setHeader(
            "X-RateLimit-Reset",
            String(Math.ceil(new Date(resetTime).getTime() / 1000))
          );
        }

        logger.warn("RateLimit exceeded", {
          type: "rate_limit",
          group,
          requestId: req.requestId || null,
          userId: req.user?.id || null,
          ip: req.ip,
          method: req.method,
          path: req.originalUrl,
          limit: max,
          windowMs,
          retryAfterSec,
          store: getStatus().mode,
        });

        return res.status(options.statusCode || 429).json({
          success: false,
          message: message || "Muitas requisicoes. Aguarde e tente novamente.",
          code: "RATE_LIMIT_EXCEEDED",
          data: {
            group,
            retryAfterSec,
            limit: max,
            windowMs,
          },
        });
      },
      message: {
        success: false,
        message: message || "Muitas requisicoes. Aguarde e tente novamente.",
        code: "RATE_LIMIT_EXCEEDED",
      },
    });

    this._cache.set(cacheKey, limiter);
    return limiter;
  }

  forGroup(groupName) {
    const def = this.config.groups[groupName];
    if (!def) {
      throw new AppError(`Grupo de rate limit desconhecido: ${groupName}`, 500);
    }
    return this.createLimiter({
      group: groupName,
      windowMs: def.windowMs,
      max: def.max,
      message: def.message,
      keyBy: def.keyBy || "ip",
    });
  }

  global() {
    const { windowMs, max, message } = this.config.global;
    return this.createLimiter({
      group: "global",
      windowMs,
      max,
      message,
      keyBy: "ip",
    });
  }

  loginSlowDown() {
    const cfg = this.config.loginSlowDown;
    return slowDown({
      windowMs: cfg.windowMs,
      delayAfter: cfg.delayAfter,
      delayMs: () => cfg.delayMs,
      validate: { delayMs: false },
    });
  }

  getConfig() {
    return this.config;
  }

  getStoreStatus() {
    return getStatus();
  }
}

const rateLimitService = new RateLimitService();

module.exports = {
  RateLimitService,
  rateLimitService,
};
