const ROLES = Object.freeze({
  USER: "USER",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
  SUPPORT: "SUPPORT",
  MODERATOR: "MODERATOR",
});

/** Hierarquia: papel de nivel >= do exigido passa. */
const ROLE_RANK = Object.freeze({
  [ROLES.USER]: 1,
  [ROLES.MODERATOR]: 2,
  [ROLES.SUPPORT]: 3,
  [ROLES.ADMIN]: 4,
  [ROLES.SUPER_ADMIN]: 5,
});

const ACCOUNT_STATUS = Object.freeze({
  ACTIVE: "ativa",
  INACTIVE: "inativa",
  SUSPENDED: "suspensa",
});

const SESSION_STATUS = Object.freeze({
  ACTIVE: "ativa",
  REVOKED: "revogada",
  EXPIRED: "expirada",
});

const AUDIT_ACTIONS = Object.freeze({
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILURE: "LOGIN_FAILURE",
  LOGOUT: "LOGOUT",
  REGISTER: "REGISTER",
  REFRESH_TOKEN: "REFRESH_TOKEN",
  REFRESH_REUSE: "REFRESH_REUSE",
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
  PASSWORD_RESET_REQUEST: "PASSWORD_RESET_REQUEST",
  PASSWORD_RESET_COMPLETE: "PASSWORD_RESET_COMPLETE",
  EMAIL_CHANGE: "EMAIL_CHANGE",
  PROFILE_UPDATE: "PROFILE_UPDATE",
  ROLE_CHANGE: "ROLE_CHANGE",
  ACCOUNT_SUSPEND: "ACCOUNT_SUSPEND",
  ACCOUNT_REACTIVATE: "ACCOUNT_REACTIVATE",
  ACCOUNT_DELETE: "ACCOUNT_DELETE",
  FORCE_LOGOUT: "FORCE_LOGOUT",
  SESSION_REVOKE: "SESSION_REVOKE",
  ADMIN_ACCESS: "ADMIN_ACCESS",
  EMAIL_VERIFY: "EMAIL_VERIFY",
});

const SUSPENDED_MESSAGE =
  "Sua conta encontra-se temporariamente suspensa. Entre em contato com o suporte.";

const GENERIC_AUTH_FAILURE = "Credenciais invalidas.";

function hasMinimumRole(userRole, requiredRole) {
  return (ROLE_RANK[userRole] || 0) >= (ROLE_RANK[requiredRole] || Infinity);
}

function hasAnyRole(userRole, allowedRoles = []) {
  if (!allowedRoles.length) return true;
  return allowedRoles.some((role) => userRole === role || hasMinimumRole(userRole, role));
}

module.exports = {
  ROLES,
  ROLE_RANK,
  ACCOUNT_STATUS,
  SESSION_STATUS,
  AUDIT_ACTIONS,
  SUSPENDED_MESSAGE,
  GENERIC_AUTH_FAILURE,
  hasMinimumRole,
  hasAnyRole,
};
