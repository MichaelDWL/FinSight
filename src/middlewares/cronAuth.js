const crypto = require("crypto");
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
  const provided = String(fromBearer || fromHeader || "");

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  if (
    !provided ||
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return next(new AppError("Nao autorizado.", 401));
  }

  return next();
}

module.exports = { verifyCronSecret };
