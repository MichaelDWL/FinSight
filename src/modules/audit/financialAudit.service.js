const pool = require("../../database/pool");

/**
 * Auditoria financeira imutavel (trigger impede UPDATE/DELETE).
 */
async function record({
  userId,
  entityType,
  entityId,
  operation,
  previousValues = null,
  newValues = null,
  origin = "api",
  ip = null,
  userAgent = null,
  client = null,
}) {
  const db = client || pool;
  await db.query(
    `
      INSERT INTO logs_auditoria_financeira (
        usuario_id, entidade_tipo, entidade_id, operacao,
        valores_anteriores, valores_novos, origem, ip, user_agent
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::inet, $9)
    `,
    [
      userId || null,
      entityType,
      entityId || null,
      operation,
      previousValues ? JSON.stringify(previousValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      origin,
      ip || null,
      userAgent || null,
    ]
  );
}

function fromRequest(req) {
  return {
    ip: req?.ip || req?.headers?.["x-forwarded-for"]?.split?.(",")?.[0]?.trim() || null,
    userAgent: req?.headers?.["user-agent"] || null,
  };
}

module.exports = { record, fromRequest };
