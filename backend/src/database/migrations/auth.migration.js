async function migrateAuthAndAdmin(pool) {
  // Papel (RBAC) e campos de seguranca em usuarios
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'papel_usuario_enum') THEN
        CREATE TYPE papel_usuario_enum AS ENUM (
          'USER', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'MODERATOR'
        );
      END IF;
    END $$;
  `);

  await pool.query(`
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS papel papel_usuario_enum NOT NULL DEFAULT 'USER',
      ADD COLUMN IF NOT EXISTS email_verificado_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS tentativas_login_falhas INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS bloqueado_ate TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS suspenso_em TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS suspenso_motivo TEXT,
      ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMPTZ
  `);

  // Amplia status de conta para incluir suspensa
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'status_enum' AND e.enumlabel = 'suspensa'
      ) THEN
        ALTER TYPE status_enum ADD VALUE 'suspensa';
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_usuarios_status'
      ) THEN
        ALTER TABLE usuarios DROP CONSTRAINT chk_usuarios_status;
      END IF;

      ALTER TABLE usuarios
        ADD CONSTRAINT chk_usuarios_status
        CHECK (status IN ('ativa', 'inativa', 'suspensa'));
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessoes_usuario (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      refresh_token_hash VARCHAR(64) NOT NULL,
      token_family UUID NOT NULL DEFAULT gen_random_uuid(),
      device VARCHAR(120),
      browser VARCHAR(120),
      sistema_operacional VARCHAR(120),
      user_agent VARCHAR(512),
      ip INET,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      status VARCHAR(20) NOT NULL DEFAULT 'ativa',
      CONSTRAINT chk_sessoes_status CHECK (status IN ('ativa', 'revogada', 'expirada')),
      CONSTRAINT uq_sessoes_refresh_hash UNIQUE (refresh_token_hash)
    );

    CREATE TABLE IF NOT EXISTS tokens_refresh (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sessao_id UUID NOT NULL REFERENCES sessoes_usuario(id) ON DELETE CASCADE,
      usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL,
      token_family UUID NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      replaced_by UUID REFERENCES tokens_refresh(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_tokens_refresh_hash UNIQUE (token_hash)
    );

    CREATE TABLE IF NOT EXISTS tokens_redefinicao_senha (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ip INET,
      user_agent VARCHAR(512)
    );

    CREATE TABLE IF NOT EXISTS tokens_verificacao_email (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS logs_auditoria (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
      ator_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
      acao VARCHAR(80) NOT NULL,
      resultado VARCHAR(40) NOT NULL DEFAULT 'sucesso',
      ip INET,
      device VARCHAR(120),
      browser VARCHAR(120),
      sistema_operacional VARCHAR(120),
      user_agent VARCHAR(512),
      metadados JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT chk_logs_resultado CHECK (resultado IN ('sucesso', 'falha', 'bloqueado'))
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_usuarios_email_lower ON usuarios (LOWER(email));
    CREATE INDEX IF NOT EXISTS idx_usuarios_papel_status ON usuarios (papel, status);
    CREATE INDEX IF NOT EXISTS idx_usuarios_created_at ON usuarios (created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_sessoes_usuario_id_status
      ON sessoes_usuario (usuario_id, status);
    CREATE INDEX IF NOT EXISTS idx_sessoes_expires
      ON sessoes_usuario (expires_at) WHERE status = 'ativa';
    CREATE INDEX IF NOT EXISTS idx_sessoes_family
      ON sessoes_usuario (token_family);

    CREATE INDEX IF NOT EXISTS idx_tokens_refresh_sessao
      ON tokens_refresh (sessao_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_refresh_family
      ON tokens_refresh (token_family);
    CREATE INDEX IF NOT EXISTS idx_tokens_refresh_usuario
      ON tokens_refresh (usuario_id);

    CREATE INDEX IF NOT EXISTS idx_tokens_reset_usuario
      ON tokens_redefinicao_senha (usuario_id) WHERE used_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_tokens_verify_usuario
      ON tokens_verificacao_email (usuario_id) WHERE used_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_logs_auditoria_usuario_created
      ON logs_auditoria (usuario_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_auditoria_ator_created
      ON logs_auditoria (ator_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_auditoria_acao_created
      ON logs_auditoria (acao, created_at DESC);
  `);
}

module.exports = { migrateAuthAndAdmin };
