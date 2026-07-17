const cors = require("cors");
const helmet = require("helmet");
const env = require("../config/env");
const { globalApiLimiter } = require("./rateLimiters");

function resolveCorsOrigin() {
  if (!env.corsOrigin || env.corsOrigin === "*") {
    if (env.isProduction) {
      throw new Error("CORS_ORIGIN deve ser uma origem explicita em producao.");
    }
    // Em desenvolvimento, refletir a Origin da request (necessario para cookies)
    return true;
  }

  const origins = env.corsOrigin.split(",").map((o) => o.trim()).filter(Boolean);
  if (origins.length === 1) return origins[0];
  return (origin, callback) => {
    if (!origin || origins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin nao permitida pelo CORS."));
  };
}

function securityMiddleware(app) {
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", ...(env.corsOrigin && env.corsOrigin !== "*" ? env.corsOrigin.split(",") : [])],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: "no-referrer" },
    })
  );

  app.use(
    cors({
      origin: resolveCorsOrigin(),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Requested-With"],
    })
  );

  app.use(globalApiLimiter);
}

module.exports = securityMiddleware;
