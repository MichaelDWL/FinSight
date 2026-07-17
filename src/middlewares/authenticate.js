const AppError = require("../utils/AppError");
const { verifyAccessToken } = require("../utils/jwt");
const { getAccessTokenFromRequest } = require("../utils/cookies");
const usersRepo = require("../modules/auth/auth.users.repository");
const sessionsRepo = require("../modules/auth/sessions.repository");
const {
  ACCOUNT_STATUS,
  SUSPENDED_MESSAGE,
  hasAnyRole,
  ROLES,
} = require("../modules/auth/constants");

async function authenticate(req, _res, next) {
  try {
    const token = getAccessTokenFromRequest(req);
    if (!token) {
      throw new AppError("Autenticacao necessaria.", 401);
    }

    const payload = verifyAccessToken(token);
    const user = await usersRepo.findById(payload.sub);

    if (!user) {
      throw new AppError("Autenticacao necessaria.", 401);
    }

    if (user.status === ACCOUNT_STATUS.SUSPENDED) {
      await sessionsRepo.revokeAllUserSessions(user.id);
      throw new AppError(SUSPENDED_MESSAGE, 403);
    }

    if (user.status !== ACCOUNT_STATUS.ACTIVE) {
      throw new AppError("Conta inativa. Entre em contato com o suporte.", 403);
    }

    if (payload.sid) {
      await sessionsRepo.touchSession(payload.sid).catch(() => null);
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.nome,
      role: user.papel,
      status: user.status,
      sessionId: payload.sid || null,
    };

    return next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError("Sessao invalida ou expirada.", 401));
  }
}

function optionalAuth(req, _res, next) {
  const token = getAccessTokenFromRequest(req);
  if (!token) return next();
  return authenticate(req, _res, next);
}

function requireAuth() {
  return authenticate;
}

function requireRole(...roles) {
  const allowed = roles.length ? roles : [ROLES.ADMIN];

  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError("Autenticacao necessaria.", 401));
    }

    if (!hasAnyRole(req.user.role, allowed)) {
      return next(new AppError("Acesso negado.", 403));
    }

    return next();
  };
}

function requireAdmin() {
  return requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN);
}

function authorize(...roles) {
  return [authenticate, requireRole(...roles)];
}

function validateJWT(req, _res, next) {
  return authenticate(req, _res, next);
}

module.exports = {
  authenticate,
  optionalAuth,
  requireAuth,
  requireRole,
  requireAdmin,
  authorize,
  validateJWT,
};
