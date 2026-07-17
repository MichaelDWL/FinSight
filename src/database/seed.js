const env = require("../config/env");
const pool = require("./pool");
const { hashPassword } = require("../utils/crypto");
const { ROLES, ACCOUNT_STATUS } = require("../modules/auth/constants");
const logger = require("../utils/logger");

async function seedAdminUser() {
  if (!env.adminSeedEmail || !env.adminSeedPassword) {
    logger.warn(
      "Seed admin ignorado: defina ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD no .env"
    );
    return;
  }

  const email = env.adminSeedEmail.trim().toLowerCase();
  const existing = await pool.query(
    `SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );

  if (existing.rowCount > 0) {
    logger.info("Conta administrativa ja existe — seed ignorado.");
    return;
  }

  const passwordHash = await hashPassword(env.adminSeedPassword);

  await pool.query(
    `
      INSERT INTO usuarios (nome, email, senha_hash, status, papel, email_verificado_at)
      VALUES ($1, $2, $3, $4, $5, now())
    `,
    [env.adminSeedName, email, passwordHash, ACCOUNT_STATUS.ACTIVE, ROLES.ADMIN]
  );

  logger.info("Conta administrativa criada via seed.", { email });
}

module.exports = { seedAdminUser };
