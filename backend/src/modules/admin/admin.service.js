const AppError = require("../../utils/AppError");
const { withTransaction } = require("../../database/transaction");
const { hashToken, generateSecureToken } = require("../../utils/crypto");
const { sendEmail } = require("../email/email.service");
const usersRepo = require("../auth/auth.users.repository");
const sessionsRepo = require("../auth/sessions.repository");
const tokensRepo = require("../auth/tokens.repository");
const auditRepo = require("../auth/audit.repository");
const { writeAudit } = require("../auth/audit.service");
const {
  ACCOUNT_STATUS,
  AUDIT_ACTIONS,
  ROLES,
  ROLE_RANK,
} = require("../auth/constants");
const env = require("../../config/env");

function assertCanManage(actor, target, options = {}) {
  if (!target) throw new AppError("Usuario nao encontrado.", 404);

  if (options.forbidSelf && actor.id === target.id) {
    throw new AppError("Operacao nao permitida na propria conta.", 400);
  }

  const actorRank = ROLE_RANK[actor.role] || 0;
  const targetRank = ROLE_RANK[target.papel || target.role] || 0;

  if (targetRank >= actorRank && actor.role !== ROLES.SUPER_ADMIN) {
    throw new AppError("Nao e permitido gerenciar usuario com papel igual ou superior.", 403);
  }
}

async function listUsers(query) {
  return usersRepo.listAdmin({
    search: query.search,
    status: query.status,
    role: query.role,
    page: Number(query.page) || 1,
    pageSize: Math.min(Number(query.pageSize) || 20, 100),
  });
}

async function getUser(userId) {
  const user = await usersRepo.findById(userId);
  if (!user) throw new AppError("Usuario nao encontrado.", 404);
  return usersRepo.mapUser(user);
}

async function updateUser(actor, userId, payload, req) {
  const target = await usersRepo.findById(userId);
  assertCanManage(actor, target);

  const updated = await usersRepo.updateProfile(userId, {
    name: payload.name,
    email: payload.email,
  });

  await writeAudit(req, {
    userId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.PROFILE_UPDATE,
    metadata: { fields: Object.keys(payload) },
  });

  return usersRepo.mapUser(updated);
}

async function changeRole(actor, userId, role, req) {
  if (!Object.values(ROLES).includes(role)) {
    throw new AppError("Papel invalido.", 400);
  }

  const target = await usersRepo.findById(userId);
  assertCanManage(actor, target, { forbidSelf: true });

  if ((ROLE_RANK[role] || 0) >= (ROLE_RANK[actor.role] || 0) && actor.role !== ROLES.SUPER_ADMIN) {
    throw new AppError("Nao e permitido atribuir papel igual ou superior ao seu.", 403);
  }

  const updated = await usersRepo.setRole(userId, role);
  await writeAudit(req, {
    userId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.ROLE_CHANGE,
    metadata: { from: target.papel, to: role },
  });

  return usersRepo.mapUser(updated);
}

async function suspendUser(actor, userId, { reason } = {}, req) {
  const target = await usersRepo.findById(userId);
  assertCanManage(actor, target, { forbidSelf: true });

  const updated = await withTransaction(async (client) => {
    const user = await usersRepo.setStatus(
      userId,
      ACCOUNT_STATUS.SUSPENDED,
      { reason: reason || null },
      client
    );
    await sessionsRepo.revokeAllUserSessions(userId, client);
    await writeAudit(req, {
      userId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.ACCOUNT_SUSPEND,
      metadata: { reason },
      client,
    });
    return user;
  });

  await sendEmail({
    to: target.email,
    template: "accountSuspended",
    vars: { name: target.nome },
  });

  return usersRepo.mapUser(updated);
}

async function reactivateUser(actor, userId, req) {
  const target = await usersRepo.findById(userId);
  assertCanManage(actor, target);

  const updated = await usersRepo.setStatus(userId, ACCOUNT_STATUS.ACTIVE);
  await writeAudit(req, {
    userId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.ACCOUNT_REACTIVATE,
  });

  await sendEmail({
    to: target.email,
    template: "accountReactivated",
    vars: { name: target.nome },
  });

  return usersRepo.mapUser(updated);
}

async function forceLogout(actor, userId, req) {
  const target = await usersRepo.findById(userId);
  assertCanManage(actor, target);

  await sessionsRepo.revokeAllUserSessions(userId);
  await writeAudit(req, {
    userId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.FORCE_LOGOUT,
  });

  return { ok: true };
}

async function adminResetPassword(actor, userId, req) {
  const target = await usersRepo.findById(userId);
  assertCanManage(actor, target);

  const rawToken = generateSecureToken();
  const expiresAt = new Date(Date.now() + env.passwordResetExpiresMinutes * 60 * 1000);

  await tokensRepo.createPasswordResetToken({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt,
    ip: null,
    userAgent: "admin-reset",
  });

  const resetUrl = `${env.appPublicUrl}/#/reset-password?token=${rawToken}`;
  await sendEmail({
    to: target.email,
    template: "passwordReset",
    vars: { name: target.nome, resetUrl },
  });

  await writeAudit(req, {
    userId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.PASSWORD_RESET_REQUEST,
    metadata: { initiatedBy: "admin" },
  });

  return { ok: true };
}

/**
 * Exclusao permanente com cascade. Nao expoe dados financeiros.
 * Transacao garante rollback total em caso de falha.
 */
async function deleteUser(actor, userId, req) {
  const target = await usersRepo.findById(userId);
  assertCanManage(actor, target, { forbidSelf: true });

  await withTransaction(async (client) => {
    await sessionsRepo.revokeAllUserSessions(userId, client);
    await writeAudit(req, {
      userId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.ACCOUNT_DELETE,
      metadata: { email: target.email },
      client,
    });

    // CASCADE remove contas, cartoes, movimentacoes, investimentos,
    // metas, categorias, perfil, sessoes, tokens, etc.
    const deleted = await usersRepo.hardDelete(userId, client);
    if (!deleted) throw new AppError("Usuario nao encontrado.", 404);
  });

  return { ok: true };
}

async function getUserAuditLogs(userId, query) {
  const user = await usersRepo.findById(userId);
  if (!user) throw new AppError("Usuario nao encontrado.", 404);

  return auditRepo.listByUser(userId, {
    limit: Math.min(Number(query.limit) || 50, 200),
    offset: Number(query.offset) || 0,
  });
}

async function listAuditLogs(query) {
  return auditRepo.listAdmin({
    search: query.search,
    action: query.action,
    limit: Math.min(Number(query.limit) || 50, 200),
    offset: Number(query.offset) || 0,
  });
}

module.exports = {
  listUsers,
  getUser,
  updateUser,
  changeRole,
  suspendUser,
  reactivateUser,
  forceLogout,
  adminResetPassword,
  deleteUser,
  getUserAuditLogs,
  listAuditLogs,
};
