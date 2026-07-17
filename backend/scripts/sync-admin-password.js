/**
 * Atualiza a senha do admin seed para o valor atual de ADMIN_SEED_PASSWORD.
 * Uso: node scripts/sync-admin-password.js
 */
require("dotenv").config();
const pool = require("../src/database/pool");
const { hashPassword } = require("../src/utils/crypto");

(async () => {
  const email = (process.env.ADMIN_SEED_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD || "";
  if (!email || !password) {
    throw new Error("Defina ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD no .env");
  }

  const hash = await hashPassword(password);
  const result = await pool.query(
    `
      UPDATE usuarios
      SET senha_hash = $2,
          tentativas_login_falhas = 0,
          bloqueado_ate = NULL,
          updated_at = now()
      WHERE LOWER(email) = LOWER($1)
      RETURNING id, email, papel
    `,
    [email, hash]
  );

  if (!result.rowCount) {
    console.log("Admin nao encontrado — rode o servidor para criar via seed.");
  } else {
    console.log("Senha do admin sincronizada:", result.rows[0].email);
  }

  await pool.end();
})().catch(async (error) => {
  console.error(error.message || error);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
