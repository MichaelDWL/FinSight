const crypto = require("crypto");
const env = require("../../config/env");
const AppError = require("../../utils/AppError");
const { withTransaction } = require("../../database/transaction");
const {
  hashPassword,
  verifyPassword,
  hashToken,
  generateSecureToken,
} = require("../../utils/crypto");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../../utils/jwt");
const { parseDeviceInfo } = require("../../utils/requestMeta");
const { sendEmail } = require("../email/email.service");
const usersRepo = require("./auth.users.repository");
const sessionsRepo = require("./sessions.repository");
const tokensRepo = require("./tokens.repository");
const { writeAudit } = require("./audit.service");
const {
  ACCOUNT_STATUS,
  AUDIT_ACTIONS,
  GENERIC_AUTH_FAILURE,
  ROLES,
  SUSPENDED_MESSAGE,
} = require("./constants");

function publicUser(row) {
  return usersRepo.mapUser(row);
}

function assertNotSuspended(user) {
  if (user.status === ACCOUNT_STATUS.SUSPENDED) {
    throw new AppError(SUSPENDED_MESSAGE, 403);
  }
  if (user.status === ACCOUNT_STATUS.INACTIVE) {
    throw new AppError("Conta inativa. Entre em contato com o suporte.", 403);
  }
}

function assertNotLocked(user) {
  if (user.bloqueado_ate && new Date(user.bloqueado_ate) > new Date()) {
    const minutes = Math.max(
      1,
      Math.ceil((new Date(user.bloqueado_ate) - Date.now()) / 60000)
    );
    throw new AppError(
      `Muitas tentativas de login. Tente novamente em cerca de ${minutes} minuto(s).`,
      429
    );
  }
}

function buildTokenPair(user, sessionId, tokenFamily) {
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.papel,
    sid: sessionId,
  });

  const refreshToken = signRefreshToken({
    sub: user.id,
    sid: sessionId,
    fam: tokenFamily,
  });

  return { accessToken, refreshToken };
}

async function createAuthSession(user, req, client) {
  const meta = parseDeviceInfo(req);
  const tokenFamily = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlMs);
  const tempHash = hashToken(generateSecureToken());

  const session = await sessionsRepo.createSession(
    {
      userId: user.id,
      refreshTokenHash: tempHash,
      tokenFamily,
      device: meta.device,
      browser: meta.browser,
      operatingSystem: meta.operatingSystem,
      userAgent: meta.userAgent,
      ip: meta.ip,
      expiresAt,
    },
    client
  );

  const tokens = buildTokenPair(user, session.id, tokenFamily);
  const refreshHash = hashToken(tokens.refreshToken);

  await client.query(
    `UPDATE sessoes_usuario SET refresh_token_hash = $2 WHERE id = $1`,
    [session.id, refreshHash]
  );
  await sessionsRepo.createRefreshTokenRecord(
    {
      sessionId: session.id,
      userId: user.id,
      tokenHash: refreshHash,
      tokenFamily,
      expiresAt,
    },
    client
  );

  return {
    user: publicUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    csrfToken: generateSecureToken(24),
    sessionId: session.id,
  };
}

async function register(payload, req) {
  const email = payload.email.trim().toLowerCase();
  const existing = await usersRepo.findByEmail(email);
  if (existing) {
    throw new AppError("Nao foi possivel concluir o registro com os dados informados.", 400);
  }

  const passwordHash = await hashPassword(payload.password);

  const result = await withTransaction(async (client) => {
    const user = await usersRepo.create(
      {
        name: payload.name.trim(),
        email,
        passwordHash,
        role: ROLES.USER,
      },
      client
    );

    const session = await createAuthSession(user, req, client);

    const verifyRaw = generateSecureToken();
    const verifyExpires = new Date(
      Date.now() + env.emailVerifyExpiresHours * 60 * 60 * 1000
    );
    await tokensRepo.createEmailVerificationToken(
      {
        userId: user.id,
        email,
        tokenHash: hashToken(verifyRaw),
        expiresAt: verifyExpires,
      },
      client
    );

    await writeAudit(req, {
      userId: user.id,
      action: AUDIT_ACTIONS.REGISTER,
      metadata: { email },
      client,
    });

    return { ...session, verifyRaw };
  });

  const verifyUrl = `${env.appPublicUrl}/#/verify-email?token=${result.verifyRaw}`;
  await sendEmail({
    to: email,
    template: "welcome",
    vars: { name: payload.name },
  });
  await sendEmail({
    to: email,
    template: "emailVerification",
    vars: { name: payload.name, verifyUrl },
  });

  const { verifyRaw: _verifyRaw, ...session } = result;
  return session;
}

async function login(payload, req) {
  const email = payload.email.trim().toLowerCase();
  const user = await usersRepo.findByEmail(email);

  if (!user) {
    await writeAudit(req, {
      action: AUDIT_ACTIONS.LOGIN_FAILURE,
      result: "falha",
      metadata: { email },
    });
    throw new AppError(GENERIC_AUTH_FAILURE, 401);
  }

  assertNotSuspended(user);
  assertNotLocked(user);

  if (env.requireEmailVerified && !user.email_verificado_at) {
    throw new AppError(
      "Verifique seu e-mail antes de entrar. Confira a caixa de entrada.",
      403,
      { code: "EMAIL_NOT_VERIFIED" }
    );
  }

  const valid = await verifyPassword(user.senha_hash, payload.password);
  if (!valid) {
    await usersRepo.recordLoginFailure(user.id, {
      maxAttempts: env.loginMaxAttempts,
      lockMinutes: env.loginLockMinutes,
    });
    await writeAudit(req, {
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN_FAILURE,
      result: "falha",
      metadata: { email },
    });
    throw new AppError(GENERIC_AUTH_FAILURE, 401);
  }

  return withTransaction(async (client) => {
    await usersRepo.recordLoginSuccess(user.id, client);
    const authSession = await createAuthSession(user, req, client);
    await writeAudit(req, {
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      client,
    });
    return authSession;
  });
}

async function refresh(req) {
  const rawRefresh = req.cookies?.finsight_refresh;
  if (!rawRefresh) {
    throw new AppError("Refresh token ausente.", 401);
  }

  try {
    verifyRefreshToken(rawRefresh);
  } catch {
    throw new AppError("Refresh token invalido ou expirado.", 401);
  }

  const presentedHash = hashToken(rawRefresh);
  const storedToken = await sessionsRepo.findRefreshTokenByHash(presentedHash);

  if (storedToken && storedToken.revoked_at) {
    await sessionsRepo.revokeTokenFamily(storedToken.token_family);
    await writeAudit(req, {
      userId: storedToken.usuario_id,
      action: AUDIT_ACTIONS.REFRESH_REUSE,
      result: "bloqueado",
      metadata: { family: storedToken.token_family },
    });
    throw new AppError("Sessao comprometida. Faca login novamente.", 401);
  }

  const session = await sessionsRepo.findActiveSessionByRefreshHash(presentedHash);
  if (!session || !storedToken) {
    throw new AppError("Sessao invalida ou expirada.", 401);
  }

  if (session.usuario_status === ACCOUNT_STATUS.SUSPENDED) {
    await sessionsRepo.revokeAllUserSessions(session.usuario_id);
    throw new AppError(SUSPENDED_MESSAGE, 403);
  }

  const user = await usersRepo.findById(session.usuario_id);
  if (!user) throw new AppError("Sessao invalida ou expirada.", 401);
  assertNotSuspended(user);

  const expiresAt = new Date(Date.now() + env.refreshTokenTtlMs);
  const tokens = buildTokenPair(user, session.id, session.token_family);
  const newHash = hashToken(tokens.refreshToken);

  await withTransaction(async (client) => {
    await sessionsRepo.rotateRefreshToken(
      {
        sessionId: session.id,
        oldTokenId: storedToken.id,
        newTokenHash: newHash,
        tokenFamily: session.token_family,
        expiresAt,
        userId: user.id,
      },
      client
    );
    await writeAudit(req, {
      userId: user.id,
      action: AUDIT_ACTIONS.REFRESH_TOKEN,
      client,
    });
  });

  return {
    user: publicUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    csrfToken: generateSecureToken(24),
    sessionId: session.id,
  };
}

async function logout(req) {
  const rawRefresh = req.cookies?.finsight_refresh;
  if (rawRefresh) {
    const presentedHash = hashToken(rawRefresh);
    const session = await sessionsRepo.findActiveSessionByRefreshHash(presentedHash);
    if (session) {
      await sessionsRepo.revokeSession(session.id);
      await writeAudit(req, {
        userId: session.usuario_id,
        action: AUDIT_ACTIONS.LOGOUT,
      });
    }
  }
  return { ok: true };
}

async function requestPasswordReset(email, req) {
  const normalized = email.trim().toLowerCase();
  const user = await usersRepo.findByEmail(normalized);

  if (!user || user.status === ACCOUNT_STATUS.SUSPENDED) {
    await writeAudit(req, {
      userId: user?.id || null,
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUEST,
      result: user ? "sucesso" : "falha",
      metadata: { email: normalized },
    });
    return { ok: true };
  }

  const rawToken = generateSecureToken();
  const meta = parseDeviceInfo(req);
  const expiresAt = new Date(Date.now() + env.passwordResetExpiresMinutes * 60 * 1000);

  await tokensRepo.createPasswordResetToken({
    userId: user.id,
    tokenHash: hashToken(rawToken),
    expiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const resetUrl = `${env.appPublicUrl}/#/reset-password?token=${rawToken}`;
  await sendEmail({
    to: user.email,
    template: "passwordReset",
    vars: { name: user.nome, resetUrl },
  });

  await writeAudit(req, {
    userId: user.id,
    action: AUDIT_ACTIONS.PASSWORD_RESET_REQUEST,
  });

  return { ok: true };
}

async function resetPassword({ token, password }, req) {
  const record = await tokensRepo.findValidPasswordResetToken(hashToken(token));
  if (!record) {
    throw new AppError("Token de recuperacao invalido ou expirado.", 400);
  }

  if (record.status === ACCOUNT_STATUS.SUSPENDED) {
    throw new AppError(SUSPENDED_MESSAGE, 403);
  }

  const passwordHash = await hashPassword(password);

  await withTransaction(async (client) => {
    await usersRepo.updatePassword(record.usuario_id, passwordHash, client);
    await tokensRepo.markPasswordResetUsed(record.id, client);
    await sessionsRepo.revokeAllUserSessions(record.usuario_id, client);
    await writeAudit(req, {
      userId: record.usuario_id,
      action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETE,
      client,
    });
  });

  await sendEmail({
    to: record.email,
    template: "passwordChanged",
    vars: { name: record.nome },
  });

  return { ok: true };
}

async function verifyEmail(token, req) {
  const record = await tokensRepo.findValidEmailVerificationToken(hashToken(token));
  if (!record) {
    throw new AppError("Token de verificacao invalido ou expirado.", 400);
  }

  await withTransaction(async (client) => {
    await usersRepo.markEmailVerified(record.usuario_id, client);
    await tokensRepo.markEmailVerificationUsed(record.id, client);
    await writeAudit(req, {
      userId: record.usuario_id,
      action: AUDIT_ACTIONS.EMAIL_VERIFY,
      client,
    });
  });

  return { ok: true };
}

async function changePassword(userId, { currentPassword, newPassword }, req) {
  const user = await usersRepo.findById(userId);
  if (!user) throw new AppError("Usuario nao encontrado.", 404);

  const valid = await verifyPassword(user.senha_hash, currentPassword);
  if (!valid) throw new AppError("Senha atual incorreta.", 400);

  const passwordHash = await hashPassword(newPassword);
  await withTransaction(async (client) => {
    await usersRepo.updatePassword(userId, passwordHash, client);
    await sessionsRepo.revokeAllUserSessions(userId, client);
    await writeAudit(req, {
      userId,
      action: AUDIT_ACTIONS.PASSWORD_CHANGE,
      client,
    });
  });

  await sendEmail({
    to: user.email,
    template: "passwordChanged",
    vars: { name: user.nome },
  });

  return { ok: true, sessionsRevoked: true };
}

async function listSessions(userId) {
  return sessionsRepo.listUserSessions(userId);
}

async function revokeSession(userId, sessionId, req) {
  const session = await sessionsRepo.findUserSession(userId, sessionId);
  if (!session) throw new AppError("Sessao nao encontrada.", 404);
  await sessionsRepo.revokeSession(sessionId);
  await writeAudit(req, {
    userId,
    action: AUDIT_ACTIONS.SESSION_REVOKE,
    metadata: { sessionId },
  });
  return { ok: true };
}

async function revokeAllSessions(userId, req) {
  await sessionsRepo.revokeAllUserSessions(userId);
  await writeAudit(req, {
    userId,
    action: AUDIT_ACTIONS.FORCE_LOGOUT,
  });
  return { ok: true };
}

async function getMe(userId) {
  const user = await usersRepo.findById(userId);
  if (!user) throw new AppError("Usuario nao encontrado.", 404);
  return publicUser(user);
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  changePassword,
  listSessions,
  revokeSession,
  revokeAllSessions,
  getMe,
  createAuthSession,
};
