const AppError = require("./AppError");

/**
 * Resolve o usuario autenticado a partir de req.user
 * (preenchido pelo middleware authenticate).
 */
function getCurrentUserId(req) {
  if (!req?.user?.id) {
    throw new AppError("Autenticacao necessaria.", 401);
  }
  return req.user.id;
}

module.exports = { getCurrentUserId };
