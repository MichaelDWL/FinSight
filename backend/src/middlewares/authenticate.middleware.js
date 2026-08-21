const AppError = require("../utils/AppError");
const { verifyAccessToken } = require("../utils/jwt");
const { getAccessTokenFromRequest } = require("../utils/cookies");
const env = require("../config/env");
const usersRepo = require("../modules/auth/auth.users.repository");
const sessionsRepo = require("../modules/auth/sessions.repository");
const {
  ACCOUNT_STATUS,
  SUSPENDED_MESSAGE,
  hasAnyRole,
  ROLES,
} = require("../modules/auth/constants");

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const touchedAt = new Map();

function shouldTouchSession(sessionId) {
  const last = touchedAt.get(sessionId);
  if (!last) return true;
  return Date.now() - last >= TOUCH_INTERVAL_MS;
}

function recordTouch(sessionId) {
  touchedAt.set(sessionId, Date.now());
  if (touchedAt.size > 5000) {
    const oldest = touchedAt.keys().next().value;
    touchedAt.delete(oldest);
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

async function authenticate(req, _res, next) {
  try {
    const token = getAccessTokenFromRequest(req);
    if (!token) {
      throw new AppError("Autenticacao necessaria.", 401);
    }

    const payload = verifyAccessToken(token);
    const isSafeMethod = SAFE_METHODS.has(req.method);

    const canSkipDb = isSafeMethod && payload.status && payload.role;
    let user;
    if (canSkipDb) {
      user = {
        id: payload.sub,
        nome: payload.name || null,
        email: payload.email || null,
        papel: payload.role,
        status: payload.status,
        email_verificado_at: payload.emailVerified ? true : null,
      };
    } else {
      user = await usersRepo.findById(payload.sub);
      if (!user) {
        throw new AppError("Autenticacao necessaria.", 401);
      }
    }

    if (user.status === ACCOUNT_STATUS.SUSPENDED) {
      await sessionsRepo.revokeAllUserSessions(user.id);
      throw new AppError(SUSPENDED_MESSAGE, 403);
    }

    if (user.status !== ACCOUNT_STATUS.ACTIVE) {
      throw new AppError("Conta inativa. Entre em contato com o suporte.", 403);
    }

    if (payload.sid) {
      if (isSafeMethod && !shouldTouchSession(payload.sid)) {
        // skip touch — session assumed alive within throttle window
      } else {
        const alive = await sessionsRepo.touchSession(payload.sid);
        if (!alive) {
          throw new AppError("Sessao revogada ou expirada.", 401);
        }
        recordTouch(payload.sid);
      }
    }

    if (env.requireEmailVerified && !user.email_verificado_at) {
      const path = req.path || "";
      const allowUnverified =
        path.includes("/auth/") ||
        path.includes("/privacy/consent") ||
        path.endsWith("/users/me");
      if (!allowUnverified) {
        throw new AppError(
          "Verifique seu e-mail antes de acessar o sistema.",
          403,
          { code: "EMAIL_NOT_VERIFIED" }
        );
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.nome,
      role: user.papel,
      status: user.status,
      emailVerified: Boolean(user.email_verificado_at),
      sessionId: payload.sid || null,
      mfaEnabled: false,
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
