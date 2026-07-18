const pool = require("../../database/pool");
const env = require("../../config/env");
const { withTransaction } = require("../../database/transaction");
const { writeAudit } = require("../auth/audit.service");
const { AUDIT_ACTIONS } = require("../auth/constants");
const sessionsRepo = require("../auth/sessions.repository");
const CacheService = require("../bff/cache/cache.service");

async function recordConsent(userId, { type, accepted = true }, req) {
  const { rows } = await pool.query(
    `
      INSERT INTO consentimentos_lgpd (
        usuario_id, tipo, aceito, versao_politica, ip, user_agent
      ) VALUES ($1, $2, $3, $4, $5::inet, $6)
      RETURNING id, tipo, aceito, versao_politica, created_at
    `,
    [
      userId,
      type,
      accepted,
      env.privacyPolicyVersion,
      req?.ip || null,
      req?.headers?.["user-agent"] || null,
    ]
  );

  await writeAudit(req, {
    userId,
    action: AUDIT_ACTIONS.PROFILE_UPDATE,
    metadata: { consent: type, accepted, version: env.privacyPolicyVersion },
  });

  return rows[0];
}

async function listConsents(userId) {
  const { rows } = await pool.query(
    `
      SELECT DISTINCT ON (tipo)
             id, tipo, aceito, versao_politica, created_at
        FROM consentimentos_lgpd
       WHERE usuario_id = $1
       ORDER BY tipo, created_at DESC
    `,
    [userId]
  );
  return rows;
}

async function exportUserData(userId) {
  const [user, contas, cartoes, movimentacoes, investimentos, metas, consentimentos, sessoes] =
    await Promise.all([
      pool.query(
        `SELECT id, nome, email, status, papel, email_verificado_at, created_at, ultimo_login_at
           FROM usuarios WHERE id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT id, nome, tipo, instituicao, saldo_atual, status, created_at
           FROM contas WHERE usuario_id = $1 AND excluido_em IS NULL`,
        [userId]
      ),
      pool.query(
        `SELECT id, nome, bandeira, limite_total, status, created_at
           FROM cartoes WHERE usuario_id = $1 AND excluido_em IS NULL`,
        [userId]
      ),
      pool.query(
        `SELECT id, tipo, descricao, valor, status, data_transacao, forma_pagamento, created_at
           FROM movimentacoes WHERE usuario_id = $1 AND excluido_em IS NULL
           ORDER BY data_transacao DESC LIMIT 5000`,
        [userId]
      ),
      pool.query(
        `SELECT id, nome, tipo, valor_atual, created_at
           FROM investimentos WHERE usuario_id = $1 AND excluido_em IS NULL`,
        [userId]
      ),
      pool.query(
        `SELECT id, nome, valor_alvo, valor_atual, created_at
           FROM metas WHERE usuario_id = $1`,
        [userId]
      ).catch(() => ({ rows: [] })),
      listConsents(userId),
      sessionsRepo.listUserSessions(userId),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    privacyPolicyVersion: env.privacyPolicyVersion,
    user: user.rows[0] || null,
    accounts: contas.rows,
    cards: cartoes.rows,
    movements: movimentacoes.rows,
    investments: investimentos.rows,
    goals: metas.rows,
    consents: consentimentos,
    sessions: sessoes,
  };
}

/**
 * Soft-delete + anonimizacao LGPD.
 * Mantem registros financeiros anonimizados para integridade contábil.
 */
async function deleteAccount(userId, req) {
  const anonEmail = `deleted+${userId.slice(0, 8)}@anon.finsight.local`;
  const anonName = "Usuario removido";

  await withTransaction(async (client) => {
    await sessionsRepo.revokeAllUserSessions(userId, client);

    await client.query(
      `
        UPDATE usuarios
           SET nome = $2,
               email = $3,
               senha_hash = '!',
               status = 'inativa',
               excluido_em = now(),
               anonimizado_em = now(),
               mfa_secret_encrypted = NULL,
               mfa_enabled = false,
               updated_at = now()
         WHERE id = $1 AND excluido_em IS NULL
      `,
      [userId, anonName, anonEmail]
    );

    await client.query(
      `UPDATE contas SET excluido_em = COALESCE(excluido_em, now()) WHERE usuario_id = $1`,
      [userId]
    );
    await client.query(
      `UPDATE cartoes SET excluido_em = COALESCE(excluido_em, now()) WHERE usuario_id = $1`,
      [userId]
    );
    await client.query(
      `UPDATE investimentos SET excluido_em = COALESCE(excluido_em, now()) WHERE usuario_id = $1`,
      [userId]
    );

    await writeAudit(req, {
      userId,
      action: AUDIT_ACTIONS.ACCOUNT_DELETE,
      client,
      metadata: { anonymized: true },
    });
  });

  await CacheService.invalidateUser(userId).catch(() => null);

  return { ok: true, anonymized: true };
}

async function getPrivacyPolicy() {
  return {
    version: env.privacyPolicyVersion,
    url: `${env.appPublicUrl}/privacy.html`,
    updatedAt: "2026-07-17",
  };
}

module.exports = {
  recordConsent,
  listConsents,
  exportUserData,
  deleteAccount,
  getPrivacyPolicy,
};
