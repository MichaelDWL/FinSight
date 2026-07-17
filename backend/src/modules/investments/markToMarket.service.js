const pool = require("../../database/pool");
const logger = require("../../utils/logger");
const { invalidateUserAnalytics } = require("../analytics/analytics.invalidation");

/**
 * Atualiza valor_atual das posicoes de renda variavel com cotacao × quantidade.
 * So afeta registros com asset_code e quantidade preenchidos.
 */
async function syncMarkedPositions() {
  const { rows } = await pool.query(`
    UPDATE investimentos i
    SET
      valor_atual = ROUND((i.quantidade * md.current_price)::numeric, 2),
      updated_at = now()
    FROM market_data md
    WHERE i.asset_code = md.asset_code
      AND i.quantidade IS NOT NULL
      AND i.quantidade > 0
      AND md.current_price IS NOT NULL
      AND md.current_price > 0
      AND i.valor_atual IS DISTINCT FROM ROUND((i.quantidade * md.current_price)::numeric, 2)
    RETURNING i.id, i.usuario_id, i.asset_code, i.valor_atual
  `);

  const userIds = [...new Set(rows.map((row) => row.usuario_id))];
  await Promise.all(userIds.map((userId) => invalidateUserAnalytics(userId).catch(() => undefined)));

  if (rows.length) {
    logger.info("Mark-to-market aplicado", {
      positions: rows.length,
      users: userIds.length,
    });
  }

  return {
    updated: rows.length,
    users: userIds.length,
    positions: rows.map((row) => ({
      id: row.id,
      userId: row.usuario_id,
      assetCode: row.asset_code,
      value: Number(row.valor_atual),
    })),
  };
}

module.exports = { syncMarkedPositions };
