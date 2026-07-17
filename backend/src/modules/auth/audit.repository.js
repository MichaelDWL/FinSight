const pool = require("../../database/pool");

async function create(entry, client = pool) {
  const {
    userId = null,
    actorId = null,
    action,
    result = "sucesso",
    ip = null,
    device = null,
    browser = null,
    operatingSystem = null,
    userAgent = null,
    metadata = {},
  } = entry;

  await client.query(
    `
      INSERT INTO logs_auditoria (
        usuario_id, ator_id, acao, resultado, ip, device, browser,
        sistema_operacional, user_agent, metadados
      ) VALUES ($1,$2,$3,$4,$5::inet,$6,$7,$8,$9,$10::jsonb)
    `,
    [
      userId,
      actorId,
      action,
      result,
      ip,
      device,
      browser,
      operatingSystem,
      userAgent,
      JSON.stringify(metadata),
    ]
  );
}

async function listByUser(userId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `
      SELECT id, usuario_id, ator_id, acao, resultado, ip, device, browser,
             sistema_operacional, created_at, metadados
      FROM logs_auditoria
      WHERE usuario_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );
  return rows;
}

async function listAdmin({ search, action, limit = 50, offset = 0 } = {}) {
  const params = [];
  const filters = [];

  if (search) {
    params.push(`%${search}%`);
    filters.push(`(acao ILIKE $${params.length} OR metadados::text ILIKE $${params.length})`);
  }
  if (action) {
    params.push(action);
    filters.push(`acao = $${params.length}`);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  params.push(limit, offset);

  const { rows } = await pool.query(
    `
      SELECT id, usuario_id, ator_id, acao, resultado, ip, device, browser,
             sistema_operacional, created_at, metadados
      FROM logs_auditoria
      ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );
  return rows;
}

module.exports = { create, listByUser, listAdmin };
