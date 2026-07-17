const pool = require("../../database/pool");
const { ACCOUNT_STATUS } = require("./constants");

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.nome,
    email: row.email,
    status: row.status,
    role: row.papel,
    emailVerifiedAt: row.email_verificado_at,
    lastLoginAt: row.ultimo_login_at,
    failedLoginAttempts: row.tentativas_login_falhas,
    lockedUntil: row.bloqueado_ate,
    suspendedAt: row.suspenso_em,
    suspendedReason: row.suspenso_motivo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findByEmail(email, client = pool) {
  const { rows } = await client.query(
    `
      SELECT id, nome, email, senha_hash, status, papel, email_verificado_at,
             ultimo_login_at, tentativas_login_falhas, bloqueado_ate,
             suspenso_em, suspenso_motivo, created_at, updated_at
      FROM usuarios
      WHERE LOWER(email) = LOWER($1) AND excluido_em IS NULL
      LIMIT 1
    `,
    [email]
  );
  return rows[0] || null;
}

async function findById(id, client = pool) {
  const { rows } = await client.query(
    `
      SELECT id, nome, email, senha_hash, status, papel, email_verificado_at,
             ultimo_login_at, tentativas_login_falhas, bloqueado_ate,
             suspenso_em, suspenso_motivo, created_at, updated_at
      FROM usuarios
      WHERE id = $1 AND excluido_em IS NULL
      LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

async function create({ name, email, passwordHash, role = "USER" }, client = pool) {
  const { rows } = await client.query(
    `
      INSERT INTO usuarios (nome, email, senha_hash, status, papel)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, nome, email, status, papel, email_verificado_at,
                ultimo_login_at, created_at, updated_at
    `,
    [name, email.toLowerCase(), passwordHash, ACCOUNT_STATUS.ACTIVE, role]
  );
  return rows[0];
}

async function updateProfile(userId, { name, email }, client = pool) {
  const { rows } = await client.query(
    `
      UPDATE usuarios
      SET nome = COALESCE($2, nome),
          email = COALESCE($3, email),
          updated_at = now()
      WHERE id = $1 AND excluido_em IS NULL
      RETURNING id, nome, email, status, papel, email_verificado_at, ultimo_login_at, created_at
    `,
    [userId, name, email ? email.toLowerCase() : null]
  );
  return rows[0] || null;
}

async function updatePassword(userId, passwordHash, client = pool) {
  await client.query(
    `
      UPDATE usuarios
      SET senha_hash = $2,
          tentativas_login_falhas = 0,
          bloqueado_ate = NULL,
          updated_at = now()
      WHERE id = $1
    `,
    [userId, passwordHash]
  );
}

async function recordLoginSuccess(userId, client = pool) {
  await client.query(
    `
      UPDATE usuarios
      SET ultimo_login_at = now(),
          tentativas_login_falhas = 0,
          bloqueado_ate = NULL,
          updated_at = now()
      WHERE id = $1
    `,
    [userId]
  );
}

async function recordLoginFailure(userId, { maxAttempts, lockMinutes }, client = pool) {
  const { rows } = await client.query(
    `
      UPDATE usuarios
      SET tentativas_login_falhas = tentativas_login_falhas + 1,
          bloqueado_ate = CASE
            WHEN tentativas_login_falhas + 1 >= $2
              THEN now() + ($3 || ' minutes')::interval
            ELSE bloqueado_ate
          END,
          updated_at = now()
      WHERE id = $1
      RETURNING tentativas_login_falhas, bloqueado_ate
    `,
    [userId, maxAttempts, String(lockMinutes)]
  );
  return rows[0];
}

async function setStatus(userId, status, { reason = null } = {}, client = pool) {
  const { rows } = await client.query(
    `
      UPDATE usuarios
      SET status = $2,
          suspenso_em = CASE WHEN $2 = 'suspensa' THEN now() ELSE NULL END,
          suspenso_motivo = CASE WHEN $2 = 'suspensa' THEN $3 ELSE NULL END,
          updated_at = now()
      WHERE id = $1 AND excluido_em IS NULL
      RETURNING id, nome, email, status, papel, ultimo_login_at, created_at, suspenso_em, suspenso_motivo
    `,
    [userId, status, reason]
  );
  return rows[0] || null;
}

async function setRole(userId, role, client = pool) {
  const { rows } = await client.query(
    `
      UPDATE usuarios
      SET papel = $2, updated_at = now()
      WHERE id = $1 AND excluido_em IS NULL
      RETURNING id, nome, email, status, papel, ultimo_login_at, created_at
    `,
    [userId, role]
  );
  return rows[0] || null;
}

async function markEmailVerified(userId, client = pool) {
  await client.query(
    `UPDATE usuarios SET email_verificado_at = now(), updated_at = now() WHERE id = $1`,
    [userId]
  );
}

async function hardDelete(userId, client = pool) {
  const { rowCount } = await client.query(`DELETE FROM usuarios WHERE id = $1`, [userId]);
  return rowCount > 0;
}

async function listAdmin(
  { search, status, role, page = 1, pageSize = 20 } = {},
  client = pool
) {
  const params = [];
  const filters = ["excluido_em IS NULL"];

  if (search) {
    params.push(`%${search}%`);
    filters.push(`(nome ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    filters.push(`status = $${params.length}`);
  }
  if (role) {
    params.push(role);
    filters.push(`papel = $${params.length}`);
  }

  const where = `WHERE ${filters.join(" AND ")}`;
  const offset = (Math.max(page, 1) - 1) * pageSize;

  const countResult = await client.query(
    `SELECT COUNT(*)::int AS total FROM usuarios ${where}`,
    params
  );

  params.push(pageSize, offset);
  const { rows } = await client.query(
    `
      SELECT id, nome, email, status, papel, email_verificado_at,
             ultimo_login_at, created_at, updated_at, suspenso_em, suspenso_motivo
      FROM usuarios
      ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );

  return {
    items: rows.map(mapUser),
    total: countResult.rows[0].total,
    page,
    pageSize,
  };
}

module.exports = {
  mapUser,
  findByEmail,
  findById,
  create,
  updateProfile,
  updatePassword,
  recordLoginSuccess,
  recordLoginFailure,
  setStatus,
  setRole,
  markEmailVerified,
  hardDelete,
  listAdmin,
};
