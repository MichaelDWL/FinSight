const pool = require("./pool");
const logger = require("../utils/logger");

// Refatoracao do modulo financeiro: unifica despesas e contas na tabela
// movimentacoes e adiciona o suporte a origem e recorrencias.
// Toda a migracao e idempotente para funcionar em bancos ja populados.
async function migrateTransacoesToMovimentacoes() {
  // 1. Renomeia a tabela principal e suas dependencias, quando ainda estiverem
  //    com a nomenclatura antiga.
  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.transacoes') IS NOT NULL
         AND to_regclass('public.movimentacoes') IS NULL THEN
        ALTER TABLE transacoes RENAME TO movimentacoes;
      END IF;

      IF to_regclass('public.transacao_tags') IS NOT NULL
         AND to_regclass('public.movimentacao_tags') IS NULL THEN
        ALTER TABLE transacao_tags RENAME TO movimentacao_tags;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'movimentacoes' AND column_name = 'transacao_pai_id') THEN
        ALTER TABLE movimentacoes RENAME COLUMN transacao_pai_id TO movimentacao_pai_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'parcelas' AND column_name = 'transacao_id') THEN
        ALTER TABLE parcelas RENAME COLUMN transacao_id TO movimentacao_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'anexos' AND column_name = 'transacao_id') THEN
        ALTER TABLE anexos RENAME COLUMN transacao_id TO movimentacao_id;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'movimentacao_tags' AND column_name = 'transacao_id') THEN
        ALTER TABLE movimentacao_tags RENAME COLUMN transacao_id TO movimentacao_id;
      END IF;
    END $$;
  `);

  // 2. Cria os novos tipos ENUM utilizados por origem e recorrencia.
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'origem_movimentacao_enum') THEN
        CREATE TYPE origem_movimentacao_enum AS ENUM ('manual', 'recorrente', 'cartao', 'transferencia');
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'intervalo_recorrencia_enum') THEN
        CREATE TYPE intervalo_recorrencia_enum AS ENUM ('diario', 'semanal', 'mensal', 'anual');
      END IF;
    END $$;
  `);

  // 3. Adiciona as novas colunas na tabela unificada.
  await pool.query(`
    ALTER TABLE movimentacoes
      ADD COLUMN IF NOT EXISTS origem origem_movimentacao_enum NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS recorrencia_id UUID
  `);

  // 4. Cria a tabela de recorrencias.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recorrencias (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      conta_id UUID REFERENCES contas(id) ON DELETE SET NULL,
      categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
      tipo tipo_transacao_enum NOT NULL DEFAULT 'despesa',
      forma_pagamento forma_pagamento_enum NOT NULL DEFAULT 'boleto',
      descricao VARCHAR(180) NOT NULL,
      valor NUMERIC(14,2) NOT NULL,
      intervalo intervalo_recorrencia_enum NOT NULL DEFAULT 'mensal',
      dia_vencimento SMALLINT,
      proxima_geracao DATE NOT NULL,
      ativa BOOLEAN NOT NULL DEFAULT true,
      observacao TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

      CONSTRAINT chk_recorrencias_valor CHECK (valor > 0),
      CONSTRAINT chk_recorrencias_dia_vencimento
        CHECK (dia_vencimento IS NULL OR dia_vencimento BETWEEN 1 AND 31)
    )
  `);

  // 5. Garante o vinculo (FK), o trigger de updated_at e os indices.
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_movimentacoes_recorrencia') THEN
        ALTER TABLE movimentacoes
          ADD CONSTRAINT fk_movimentacoes_recorrencia
          FOREIGN KEY (recorrencia_id) REFERENCES recorrencias(id) ON DELETE SET NULL;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_recorrencias_updated_at') THEN
        CREATE TRIGGER trg_recorrencias_updated_at BEFORE UPDATE ON recorrencias
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_movimentacoes_usuario_origem ON movimentacoes (usuario_id, origem);
    CREATE INDEX IF NOT EXISTS idx_movimentacoes_recorrencia ON movimentacoes (recorrencia_id);
    CREATE INDEX IF NOT EXISTS idx_recorrencias_usuario_ativa ON recorrencias (usuario_id, ativa);
    CREATE INDEX IF NOT EXISTS idx_recorrencias_proxima_geracao ON recorrencias (proxima_geracao) WHERE ativa = true;
  `);
}

async function runMigrations() {
  await pool.query(`
    ALTER TABLE cartoes
      ADD COLUMN IF NOT EXISTS cor VARCHAR(7) DEFAULT '#0d6efd',
      ADD COLUMN IF NOT EXISTS banco VARCHAR(120),
      ADD COLUMN IF NOT EXISTS ultimos_digitos CHAR(3),
      ADD COLUMN IF NOT EXISTS observacao TEXT
  `);

  // Modulo Contas: instituicao (texto livre) e observacao. Ambos opcionais e
  // sem qualquer dado sensivel (sem agencia/numero/CPF/PIX).
  await pool.query(`
    ALTER TABLE contas
      ADD COLUMN IF NOT EXISTS instituicao VARCHAR(120),
      ADD COLUMN IF NOT EXISTS observacao TEXT
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

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_cartoes_ultimos_digitos'
      ) THEN
        ALTER TABLE cartoes
          ADD CONSTRAINT chk_cartoes_ultimos_digitos
          CHECK (ultimos_digitos IS NULL OR ultimos_digitos ~ '^[0-9]{3}$');
      END IF;
    END $$;
  `);

  await migrateTransacoesToMovimentacoes();

  logger.info("Migrations aplicadas com sucesso.");
}

module.exports = { runMigrations };
