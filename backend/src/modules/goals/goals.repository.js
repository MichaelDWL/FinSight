const pool = require("../../database/pool");
const { paginationService } = require("../../services/pagination/pagination.service");
const paginationConfig = require("../../config/pagination.config");

function mapGoal(row) {
  return {
    id: row.id,
    name: row.nome,
    target: Number(row.valor_alvo),
    current: Number(row.valor_atual),
    progress: Number(row.percentual),
    deadline: row.prazo,
    status: row.status,
  };
}

async function findAll(userId, options = {}) {
  const pagination =
    options.pagination ||
    paginationService.parseFromQuery(
      {
        page: options.page || 1,
        pageSize: options.pageSize ?? paginationConfig.pageSize.max,
        sort: options.sort,
        order: options.order,
      },
      { resource: "goals", defaultSort: "deadline" }
    );

  const order = paginationService.resolveOrderBy(pagination, "prazo ASC");

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM metas WHERE usuario_id = $1`,
    [userId]
  );

  const { rows } = await pool.query(
    `
      SELECT id, nome, valor_alvo, valor_atual, percentual, prazo, status
      FROM metas
      WHERE usuario_id = $1
      ORDER BY ${order.clause}
      LIMIT $2 OFFSET $3
    `,
    [userId, pagination.limit, pagination.offset]
  );

  return {
    items: rows.map(mapGoal),
    ...paginationService.toMeta(pagination, countResult.rows[0].total),
  };
}

async function create(userId, payload) {
  const { rows } = await pool.query(
    `
      INSERT INTO metas (usuario_id, nome, valor_alvo, valor_atual, prazo, status)
      VALUES ($1, $2, $3, $4, $5, 'ativa')
      RETURNING id
    `,
    [userId, payload.name, payload.target, payload.current || 0, payload.deadline]
  );

  return rows[0];
}

async function update(userId, id, payload) {
  const { rows } = await pool.query(
    `
      UPDATE metas
      SET
        nome = COALESCE($3, nome),
        valor_alvo = COALESCE($4, valor_alvo),
        valor_atual = COALESCE($5, valor_atual),
        prazo = COALESCE($6, prazo),
        status = COALESCE($7, status),
        updated_at = now()
      WHERE usuario_id = $1 AND id = $2
      RETURNING id
    `,
    [
      userId,
      id,
      payload.name,
      payload.target,
      payload.current,
      payload.deadline,
      payload.status,
    ]
  );

  return rows[0] || null;
}

async function remove(userId, id) {
  const { rowCount } = await pool.query(
    "DELETE FROM metas WHERE usuario_id = $1 AND id = $2",
    [userId, id]
  );
  return rowCount > 0;
}

module.exports = { findAll, create, update, remove };
