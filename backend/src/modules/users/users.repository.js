const pool = require("../../database/pool");

async function findDemo(userId) {
  const { rows } = await pool.query(
    `
      SELECT id, nome AS name, email, status, papel AS role, created_at, ultimo_login_at
      FROM usuarios
      WHERE id = $1 AND excluido_em IS NULL
    `,
    [userId]
  );

  return rows[0] || null;
}

async function update(userId, payload) {
  const { rows } = await pool.query(
    `
      UPDATE usuarios
      SET nome = COALESCE($2, nome), email = COALESCE($3, email), updated_at = now()
      WHERE id = $1
      RETURNING id, nome AS name, email, status, papel AS role
    `,
    [userId, payload.name, payload.email]
  );

  return rows[0] || null;
}

module.exports = { findDemo, update };
