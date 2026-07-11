const pool = require("../../database/pool");

function mapAccount(row) {
  return {
    id: row.id,
    icon: row.icone || "bank",
    name: row.nome,
    type: row.tipo,
    balance: Number(row.saldo_atual),
    color: row.cor || "#0d6efd",
    status: row.status,
  };
}

async function findAll(userId) {
  const { rows } = await pool.query(
    `
      SELECT id, nome, tipo, saldo_atual, cor, icone, status
      FROM contas
      WHERE usuario_id = $1
      ORDER BY created_at ASC
    `,
    [userId]
  );

  return rows.map(mapAccount);
}

async function create(userId, payload) {
  const { rows } = await pool.query(
    `
      INSERT INTO contas (usuario_id, nome, tipo, saldo_inicial, saldo_atual, cor, icone)
      VALUES ($1, $2, $3, $4, $4, $5, $6)
      RETURNING id
    `,
    [userId, payload.name, payload.type || "corrente", payload.balance || 0, payload.color || null, payload.icon || null]
  );

  return rows[0];
}

async function update(userId, id, payload) {
  const { rows } = await pool.query(
    `
      UPDATE contas
      SET
        nome = COALESCE($3, nome),
        tipo = COALESCE($4, tipo),
        saldo_atual = COALESCE($5, saldo_atual),
        cor = COALESCE($6, cor),
        icone = COALESCE($7, icone),
        updated_at = now()
      WHERE usuario_id = $1 AND id = $2
      RETURNING id
    `,
    [userId, id, payload.name, payload.type, payload.balance, payload.color, payload.icon]
  );

  return rows[0] || null;
}

async function remove(userId, id) {
  const { rowCount } = await pool.query("DELETE FROM contas WHERE usuario_id = $1 AND id = $2", [userId, id]);
  return rowCount > 0;
}

module.exports = { findAll, create, update, remove };
