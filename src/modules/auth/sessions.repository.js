const pool = require("../../database/pool");
const { SESSION_STATUS } = require("./constants");

async function createSession(
  {
    userId,
    refreshTokenHash,
    tokenFamily,
    device,
    browser,
    operatingSystem,
    userAgent,
    ip,
    expiresAt,
  },
  client = pool
) {
  const { rows } = await client.query(
    `
      INSERT INTO sessoes_usuario (
        usuario_id, refresh_token_hash, token_family, device, browser,
        sistema_operacional, user_agent, ip, expires_at, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::inet,$9,'ativa')
      RETURNING *
    `,
    [
      userId,
      refreshTokenHash,
      tokenFamily,
      device,
      browser,
      operatingSystem,
      userAgent,
      ip,
      expiresAt,
    ]
  );
  return rows[0];
}

async function createRefreshTokenRecord(
  { sessionId, userId, tokenHash, tokenFamily, expiresAt },
  client = pool
) {
  const { rows } = await client.query(
    `
      INSERT INTO tokens_refresh (sessao_id, usuario_id, token_hash, token_family, expires_at)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `,
    [sessionId, userId, tokenHash, tokenFamily, expiresAt]
  );
  return rows[0];
}

async function findActiveSessionByRefreshHash(tokenHash, client = pool) {
  const { rows } = await client.query(
    `
      SELECT s.*, u.status AS usuario_status, u.papel, u.email, u.nome
      FROM sessoes_usuario s
      JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.refresh_token_hash = $1
        AND s.status = 'ativa'
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.excluido_em IS NULL
      LIMIT 1
    `,
    [tokenHash]
  );
  return rows[0] || null;
}

async function findRefreshTokenByHash(tokenHash, client = pool) {
  const { rows } = await client.query(
    `SELECT * FROM tokens_refresh WHERE token_hash = $1 LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function rotateRefreshToken(
  { sessionId, oldTokenId, newTokenHash, tokenFamily, expiresAt, userId },
  client = pool
) {
  await client.query(
    `
      UPDATE sessoes_usuario
      SET refresh_token_hash = $2,
          last_activity = now(),
          expires_at = $3
      WHERE id = $1
    `,
    [sessionId, newTokenHash, expiresAt]
  );

  const { rows: created } = await client.query(
    `
      INSERT INTO tokens_refresh (sessao_id, usuario_id, token_hash, token_family, expires_at)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `,
    [sessionId, userId, newTokenHash, tokenFamily, expiresAt]
  );

  if (oldTokenId) {
    await client.query(
      `
        UPDATE tokens_refresh
        SET revoked_at = now(), replaced_by = $2
        WHERE id = $1
      `,
      [oldTokenId, created[0].id]
    );
  }

  return created[0];
}

async function revokeSession(sessionId, client = pool) {
  await client.query(
    `
      UPDATE sessoes_usuario
      SET status = $2, revoked_at = now()
      WHERE id = $1
    `,
    [sessionId, SESSION_STATUS.REVOKED]
  );
  await client.query(
    `
      UPDATE tokens_refresh
      SET revoked_at = COALESCE(revoked_at, now())
      WHERE sessao_id = $1 AND revoked_at IS NULL
    `,
    [sessionId]
  );
}

async function revokeAllUserSessions(userId, client = pool) {
  await client.query(
    `
      UPDATE sessoes_usuario
      SET status = $2, revoked_at = now()
      WHERE usuario_id = $1 AND status = 'ativa'
    `,
    [userId, SESSION_STATUS.REVOKED]
  );
  await client.query(
    `
      UPDATE tokens_refresh
      SET revoked_at = COALESCE(revoked_at, now())
      WHERE usuario_id = $1 AND revoked_at IS NULL
    `,
    [userId]
  );
}

async function revokeTokenFamily(tokenFamily, client = pool) {
  await client.query(
    `
      UPDATE sessoes_usuario
      SET status = $2, revoked_at = now()
      WHERE token_family = $1 AND status = 'ativa'
    `,
    [tokenFamily, SESSION_STATUS.REVOKED]
  );
  await client.query(
    `
      UPDATE tokens_refresh
      SET revoked_at = COALESCE(revoked_at, now())
      WHERE token_family = $1 AND revoked_at IS NULL
    `,
    [tokenFamily]
  );
}

async function touchSession(sessionId, client = pool) {
  const { rowCount } = await client.query(
    `
      UPDATE sessoes_usuario
         SET last_activity = now()
       WHERE id = $1
         AND status = 'ativa'
         AND revoked_at IS NULL
         AND expires_at > now()
    `,
    [sessionId]
  );
  return rowCount > 0;
}

async function findActiveSessionById(sessionId, client = pool) {
  const { rows } = await client.query(
    `
      SELECT id, usuario_id, status, expires_at, revoked_at
        FROM sessoes_usuario
       WHERE id = $1
         AND status = 'ativa'
         AND revoked_at IS NULL
         AND expires_at > now()
       LIMIT 1
    `,
    [sessionId]
  );
  return rows[0] || null;
}

async function listUserSessions(userId, client = pool) {
  const { rows } = await client.query(
    `
      SELECT id, device, browser, sistema_operacional AS operating_system,
             ip, created_at, last_activity, expires_at, status, revoked_at
      FROM sessoes_usuario
      WHERE usuario_id = $1
      ORDER BY last_activity DESC
    `,
    [userId]
  );
  return rows;
}

async function findUserSession(userId, sessionId, client = pool) {
  const { rows } = await client.query(
    `
      SELECT * FROM sessoes_usuario
      WHERE id = $1 AND usuario_id = $2
      LIMIT 1
    `,
    [sessionId, userId]
  );
  return rows[0] || null;
}

module.exports = {
  createSession,
  createRefreshTokenRecord,
  findActiveSessionByRefreshHash,
  findRefreshTokenByHash,
  rotateRefreshToken,
  revokeSession,
  revokeAllUserSessions,
  revokeTokenFamily,
  touchSession,
  listUserSessions,
  findUserSession,
  findActiveSessionById,
};
