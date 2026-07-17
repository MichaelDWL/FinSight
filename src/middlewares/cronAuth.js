const env = require("../config/env");
const AppError = require("../utils/AppError");

/**
 * Protege endpoints de job (cron). Independente da Vercel:
 * - Header Authorization: Bearer <CRON_SECRET>
 * - ou Header x-cron-secret: <CRON_SECRET>
 */
function verifyCronSecret(req, _res, next) {
  const expected = env.cronSecret;
  if (!expected) {
    return next(
      new AppError("CRON_SECRET nao configurado. Jobs HTTP desabilitados.", 503)
    );
  }

  const bearer = String(req.headers.authorization || "");
  const fromBearer = bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : null;
  const fromHeader = req.headers["x-cron-secret"];
  const provided = fromBearer || fromHeader;

  if (!provided || provided !== expected) {
    return next(new AppError("Nao autorizado.", 401));
  }

  return next();
}

module.exports = { verifyCronSecret };
