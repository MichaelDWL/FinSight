const pool = require("../../database/pool");

async function createPasswordResetToken({ userId, tokenHash, expiresAt, ip, userAgent }, client = pool) {
  await client.query(
    `UPDATE tokens_redefinicao_senha SET used_at = now() WHERE usuario_id = $1 AND used_at IS NULL`,
    [userId]
  );

  const { rows } = await client.query(
    `
      INSERT INTO tokens_redefinicao_senha (usuario_id, token_hash, expires_at, ip, user_agent)
      VALUES ($1,$2,$3,$4::inet,$5)
      RETURNING *
    `,
    [userId, tokenHash, expiresAt, ip, userAgent]
  );
  return rows[0];
}

async function findValidPasswordResetToken(tokenHash, client = pool) {
  const { rows } = await client.query(
    `
      SELECT t.*, u.email, u.nome, u.status
      FROM tokens_redefinicao_senha t
      JOIN usuarios u ON u.id = t.usuario_id
      WHERE t.token_hash = $1
        AND t.used_at IS NULL
        AND t.expires_at > now()
        AND u.excluido_em IS NULL
      LIMIT 1
    `,
    [tokenHash]
  );
  return rows[0] || null;
}

async function markPasswordResetUsed(id, client = pool) {
  await client.query(
    `UPDATE tokens_redefinicao_senha SET used_at = now() WHERE id = $1`,
    [id]
  );
}

async function createEmailVerificationToken({ userId, email, tokenHash, expiresAt }, client = pool) {
  await client.query(
    `UPDATE tokens_verificacao_email SET used_at = now() WHERE usuario_id = $1 AND used_at IS NULL`,
    [userId]
  );

  const { rows } = await client.query(
    `
      INSERT INTO tokens_verificacao_email (usuario_id, email, token_hash, expires_at)
      VALUES ($1,$2,$3,$4)
      RETURNING *
    `,
    [userId, email, tokenHash, expiresAt]
  );
  return rows[0];
}

async function findValidEmailVerificationToken(tokenHash, client = pool) {
  const { rows } = await client.query(
    `
      SELECT t.*, u.nome
      FROM tokens_verificacao_email t
      JOIN usuarios u ON u.id = t.usuario_id
      WHERE t.token_hash = $1
        AND t.used_at IS NULL
        AND t.expires_at > now()
      LIMIT 1
    `,
    [tokenHash]
  );
  return rows[0] || null;
}

async function markEmailVerificationUsed(id, client = pool) {
  await client.query(
    `UPDATE tokens_verificacao_email SET used_at = now() WHERE id = $1`,
    [id]
  );
}

module.exports = {
  createPasswordResetToken,
  findValidPasswordResetToken,
  markPasswordResetUsed,
  createEmailVerificationToken,
  findValidEmailVerificationToken,
  markEmailVerificationUsed,
};
