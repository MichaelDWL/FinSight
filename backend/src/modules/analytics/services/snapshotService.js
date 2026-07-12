const pool = require("../../../database/pool");

async function ensureCurrentSnapshot(userId) {
  await pool.query(
    `
      INSERT INTO investimentos_snapshots (usuario_id, mes_referencia, patrimonio_total, total_aportado)
      SELECT
        $1,
        date_trunc('month', CURRENT_DATE)::date,
        COALESCE(SUM(valor_atual), 0),
        COALESCE(SUM(valor_inicial), 0)
      FROM investimentos
      WHERE usuario_id = $1
      ON CONFLICT (usuario_id, mes_referencia)
      DO UPDATE SET
        patrimonio_total = EXCLUDED.patrimonio_total,
        total_aportado = EXCLUDED.total_aportado,
        updated_at = now()
    `,
    [userId],
  );
}

module.exports = { ensureCurrentSnapshot };
