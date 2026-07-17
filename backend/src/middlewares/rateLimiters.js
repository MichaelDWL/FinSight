const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const env = require("../config/env");

function createLimiter({ windowMs = env.rateLimitWindowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: message || "Muitas tentativas. Aguarde um pouco e tente novamente.",
    },
  });
}

function createSlowDown({ windowMs = env.rateLimitWindowMs, delayAfter, delayMs = 500 }) {
  return slowDown({
    windowMs,
    delayAfter,
    delayMs: () => delayMs,
    validate: { delayMs: false },
  });
}

const globalApiLimiter = createLimiter({
  max: env.rateLimitMax,
});

const loginLimiter = createLimiter({
  max: env.rateLimitLoginMax,
  windowMs: 15 * 60 * 1000,
  message: "Muitas tentativas de login. Aguarde e tente novamente.",
});

const loginSlowDown = createSlowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 3,
  delayMs: 750,
});

const registerLimiter = createLimiter({
  max: env.rateLimitRegisterMax,
  windowMs: 60 * 60 * 1000,
  message: "Muitos registros a partir deste IP. Tente mais tarde.",
});

const passwordResetLimiter = createLimiter({
  max: env.rateLimitPasswordResetMax,
  windowMs: 60 * 60 * 1000,
  message: "Muitas solicitacoes de recuperacao. Tente mais tarde.",
});

const refreshLimiter = createLimiter({
  max: env.rateLimitRefreshMax,
  windowMs: 15 * 60 * 1000,
});

const adminLimiter = createLimiter({
  max: env.rateLimitAdminMax,
  windowMs: 15 * 60 * 1000,
  message: "Limite de requisicoes administrativas atingido.",
});

module.exports = {
  createLimiter,
  globalApiLimiter,
  loginLimiter,
  loginSlowDown,
  registerLimiter,
  passwordResetLimiter,
  refreshLimiter,
  adminLimiter,
};
