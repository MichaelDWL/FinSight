const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const env = require("../config/env");

function securityMiddleware(app) {
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
    })
  );
  app.use(
    rateLimit({
      windowMs: env.rateLimitWindowMs,
      max: env.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: "Muitas tentativas. Aguarde um pouco e tente novamente.",
      },
    })
  );
}

module.exports = securityMiddleware;
