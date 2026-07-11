const pool = require("./pool");
const logger = require("../utils/logger");

async function runMigrations() {
  await pool.query(`
    ALTER TABLE cartoes
      ADD COLUMN IF NOT EXISTS cor VARCHAR(7) DEFAULT '#0d6efd'
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_cartoes_cor_hex'
      ) THEN
        ALTER TABLE cartoes
          ADD CONSTRAINT chk_cartoes_cor_hex
          CHECK (cor IS NULL OR cor ~ '^#[0-9A-Fa-f]{6}$');
      END IF;
    END $$;
  `);

  logger.info("Migrations aplicadas com sucesso.");
}

module.exports = { runMigrations };
