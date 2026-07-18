const env = require("../config/env");
const AppError = require("../utils/AppError");
const { timingSafeEqualString } = require("../utils/crypto");
const {
  getCsrfTokenFromRequest,
  CSRF_COOKIE,
} = require("../utils/cookies");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Double-submit cookie: o frontend envia o valor do cookie nao-HttpOnly
 * no header X-CSRF-Token em mutacoes.
 */
function csrfProtection(req, _res, next) {
  if (!env.csrfEnabled) return next();
  if (SAFE_METHODS.has(req.method)) return next();

  // Rotas publicas de auth que ainda nao possuem CSRF cookie
  const path = req.path || "";
  const openPaths = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/refresh",
  ];
  if (openPaths.some((p) => path.endsWith(p) || path.includes(`/auth${p}`))) {
    return next();
  }

  const cookieToken = getCsrfTokenFromRequest(req);
  const headerToken = req.headers["x-csrf-token"];

  if (!cookieToken || !headerToken || !timingSafeEqualString(cookieToken, headerToken)) {
    return next(new AppError("Falha de validacao CSRF.", 403));
  }

  return next();
}

module.exports = { csrfProtection, CSRF_COOKIE };
