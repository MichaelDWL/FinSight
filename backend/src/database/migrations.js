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
  await migrateAnalyticsViews();
  await migrateInvestmentAnalytics();
  await migrateMarketData();
  await migrateMarketProviders();
  await migratePersonalization();

  logger.info("Migrations aplicadas com sucesso.");
}

async function migrateMarketData() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_data (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      asset_code VARCHAR(40) NOT NULL,
      asset_name VARCHAR(180) NOT NULL,
      asset_type VARCHAR(40) NOT NULL,
      current_price NUMERIC(18,6) NOT NULL DEFAULT 0,
      currency CHAR(3) NOT NULL DEFAULT 'BRL',
      daily_change NUMERIC(12,4),
      monthly_change NUMERIC(12,4),
      yearly_change NUMERIC(12,4),
      source VARCHAR(40) NOT NULL,
      last_update TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_market_data_asset_code UNIQUE (asset_code),
      CONSTRAINT chk_market_data_asset_type CHECK (
        asset_type IN ('stock', 'index', 'commodity', 'crypto', 'etf', 'fii', 'fx', 'other')
      )
    );

    CREATE TABLE IF NOT EXISTS economic_rates (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      selic NUMERIC(12,4),
      ipca NUMERIC(12,4),
      cdi NUMERIC(12,4),
      dolar NUMERIC(12,6),
      euro NUMERIC(12,6),
      last_update TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS market_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      asset_code VARCHAR(40) NOT NULL,
      price NUMERIC(18,6) NOT NULL,
      date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_market_history_asset_date UNIQUE (asset_code, date)
    );

    CREATE TABLE IF NOT EXISTS economic_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      indicator VARCHAR(20) NOT NULL,
      value NUMERIC(18,6) NOT NULL,
      reference_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_economic_history_indicator_date UNIQUE (indicator, reference_date),
      CONSTRAINT chk_economic_history_indicator CHECK (
        indicator IN ('SELIC', 'IPCA', 'CDI', 'USD', 'EUR')
      )
    );

    CREATE TABLE IF NOT EXISTS market_watchlist (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      asset_code VARCHAR(40) NOT NULL,
      asset_name VARCHAR(180) NOT NULL,
      asset_type VARCHAR(40) NOT NULL,
      stooq_symbol VARCHAR(40) NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_market_watchlist_asset_code UNIQUE (asset_code)
    );

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_market_data_updated_at') THEN
        CREATE TRIGGER trg_market_data_updated_at
        BEFORE UPDATE ON market_data
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_market_data_type_update
      ON market_data (asset_type, last_update DESC);
    CREATE INDEX IF NOT EXISTS idx_market_data_last_update
      ON market_data (last_update DESC);
    CREATE INDEX IF NOT EXISTS idx_market_history_asset_date
      ON market_history (asset_code, date DESC);
    CREATE INDEX IF NOT EXISTS idx_economic_history_indicator_date
      ON economic_history (indicator, reference_date DESC);
    CREATE INDEX IF NOT EXISTS idx_market_watchlist_active
      ON market_watchlist (active) WHERE active = true;
  `);

  await pool.query(`
    INSERT INTO economic_rates (id, selic, ipca, cdi, dolar, euro, last_update)
    VALUES (1, NULL, NULL, NULL, NULL, NULL, NULL)
    ON CONFLICT (id) DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO market_watchlist (asset_code, asset_name, asset_type, stooq_symbol)
    VALUES
      ('IBOV', 'Ibovespa', 'index', '^bvsp'),
      ('PETR4', 'Petrobras PN', 'stock', 'petr4.br'),
      ('VALE3', 'Vale ON', 'stock', 'vale3.br'),
      ('ITUB4', 'Itau Unibanco PN', 'stock', 'itub4.br'),
      ('BBDC4', 'Bradesco PN', 'stock', 'bbdc4.br'),
      ('WEGE3', 'WEG ON', 'stock', 'wege3.br'),
      ('BOVA11', 'iShares Ibovespa', 'etf', 'bova11.br'),
      ('HGLG11', 'CSHG Logistica FII', 'fii', 'hglg11.br'),
      ('GOLD', 'Ouro (XAU/USD)', 'commodity', 'xauusd'),
      ('WTI', 'Petroleo WTI', 'commodity', 'cl.f'),
      ('BTCUSD', 'Bitcoin', 'crypto', 'btcusd'),
      ('ETHUSD', 'Ethereum', 'crypto', 'ethusd')
    ON CONFLICT (asset_code) DO NOTHING;
  `);

  await pool.query(`
    ALTER TABLE investimentos
      ADD COLUMN IF NOT EXISTS tipo_investimento VARCHAR(40),
      ADD COLUMN IF NOT EXISTS asset_code VARCHAR(40),
      ADD COLUMN IF NOT EXISTS quantidade NUMERIC(18,8),
      ADD COLUMN IF NOT EXISTS percentual_cdi NUMERIC(8,2),
      ADD COLUMN IF NOT EXISTS taxa_prefixada NUMERIC(8,4),
      ADD COLUMN IF NOT EXISTS taxa_ipca_spread NUMERIC(8,4),
      ADD COLUMN IF NOT EXISTS moeda CHAR(3) NOT NULL DEFAULT 'BRL';
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_investimentos_tipo'
      ) THEN
        ALTER TABLE investimentos
          ADD CONSTRAINT chk_investimentos_tipo CHECK (
            tipo_investimento IS NULL OR tipo_investimento IN (
              'tesouro_selic', 'tesouro_ipca', 'tesouro_prefixado',
              'cdb', 'lci', 'lca', 'poupanca',
              'acoes', 'fiis', 'etfs', 'criptomoedas', 'fundos', 'outro'
            )
          );
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_investimentos_tipo
      ON investimentos (usuario_id, tipo_investimento);
    CREATE INDEX IF NOT EXISTS idx_investimentos_asset_code
      ON investimentos (asset_code)
      WHERE asset_code IS NOT NULL;
  `);
}

async function migrateMarketProviders() {
  await pool.query(`
    ALTER TABLE market_watchlist
      ADD COLUMN IF NOT EXISTS symbols JSONB;

    UPDATE market_watchlist
    SET symbols = jsonb_build_object(
      'brapi', asset_code,
      'stooq', COALESCE(stooq_symbol, lower(asset_code) || '.br')
    )
    WHERE symbols IS NULL;

    ALTER TABLE market_history
      ADD COLUMN IF NOT EXISTS provider VARCHAR(40),
      ADD COLUMN IF NOT EXISTS source VARCHAR(40);

    CREATE TABLE IF NOT EXISTS market_quote_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      asset_code VARCHAR(40) NOT NULL,
      price NUMERIC(18,6) NOT NULL,
      currency CHAR(3) NOT NULL DEFAULT 'BRL',
      provider VARCHAR(40) NOT NULL,
      source VARCHAR(40) NOT NULL,
      quote_date DATE NOT NULL,
      quote_time TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS market_provider_status (
      provider VARCHAR(40) PRIMARY KEY,
      status VARCHAR(20) NOT NULL DEFAULT 'unknown',
      last_success TIMESTAMPTZ,
      last_error TEXT,
      response_time INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT chk_market_provider_status CHECK (
        status IN ('online', 'offline', 'degraded', 'unknown')
      )
    );

    CREATE INDEX IF NOT EXISTS idx_market_quote_log_asset_time
      ON market_quote_log (asset_code, quote_time DESC);
    CREATE INDEX IF NOT EXISTS idx_market_quote_log_provider
      ON market_quote_log (provider, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_market_history_provider
      ON market_history (provider)
      WHERE provider IS NOT NULL;
  `);

  await pool.query(`
    INSERT INTO market_provider_status (provider, status)
    VALUES
      ('bcb', 'unknown'),
      ('brapi', 'unknown'),
      ('stooq', 'unknown')
    ON CONFLICT (provider) DO NOTHING;
  `);
}

async function migrateInvestmentAnalytics() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS investimentos_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      mes_referencia DATE NOT NULL,
      patrimonio_total NUMERIC(14,2) NOT NULL DEFAULT 0,
      total_aportado NUMERIC(14,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_investimentos_snapshots_usuario_mes UNIQUE (usuario_id, mes_referencia),
      CONSTRAINT chk_investimentos_snapshots_mes
        CHECK (date_trunc('month', mes_referencia)::date = mes_referencia)
    );

    CREATE TABLE IF NOT EXISTS indices_financeiros (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      indice VARCHAR(20) NOT NULL,
      mes_referencia DATE NOT NULL,
      valor_mensal NUMERIC(8,4) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_indices_financeiros_indice_mes UNIQUE (indice, mes_referencia),
      CONSTRAINT chk_indices_financeiros_indice CHECK (indice IN ('CDI', 'SELIC', 'IPCA'))
    );

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_investimentos_snapshots_updated_at') THEN
        CREATE TRIGGER trg_investimentos_snapshots_updated_at
        BEFORE UPDATE ON investimentos_snapshots
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_investimentos_snapshots_usuario_mes
      ON investimentos_snapshots (usuario_id, mes_referencia DESC);

    CREATE INDEX IF NOT EXISTS idx_indices_financeiros_mes
      ON indices_financeiros (mes_referencia DESC);
  `);

  await pool.query(`
    INSERT INTO indices_financeiros (indice, mes_referencia, valor_mensal)
    SELECT indice, mes, valor
    FROM (
      VALUES
        ('CDI',   '2025-08-01'::date, 0.8700),
        ('CDI',   '2025-09-01'::date, 0.8900),
        ('CDI',   '2025-10-01'::date, 0.9100),
        ('CDI',   '2025-11-01'::date, 0.8800),
        ('CDI',   '2025-12-01'::date, 0.9000),
        ('CDI',   '2026-01-01'::date, 0.9200),
        ('CDI',   '2026-02-01'::date, 0.9100),
        ('CDI',   '2026-03-01'::date, 0.9300),
        ('CDI',   '2026-04-01'::date, 0.9000),
        ('CDI',   '2026-05-01'::date, 0.8800),
        ('CDI',   '2026-06-01'::date, 0.8700),
        ('CDI',   '2026-07-01'::date, 0.8600),
        ('SELIC', '2025-08-01'::date, 0.8500),
        ('SELIC', '2025-09-01'::date, 0.8700),
        ('SELIC', '2025-10-01'::date, 0.8900),
        ('SELIC', '2025-11-01'::date, 0.8600),
        ('SELIC', '2025-12-01'::date, 0.8800),
        ('SELIC', '2026-01-01'::date, 0.9000),
        ('SELIC', '2026-02-01'::date, 0.8900),
        ('SELIC', '2026-03-01'::date, 0.9100),
        ('SELIC', '2026-04-01'::date, 0.8800),
        ('SELIC', '2026-05-01'::date, 0.8600),
        ('SELIC', '2026-06-01'::date, 0.8500),
        ('SELIC', '2026-07-01'::date, 0.8400),
        ('IPCA',  '2025-08-01'::date, 0.3500),
        ('IPCA',  '2025-09-01'::date, 0.4200),
        ('IPCA',  '2025-10-01'::date, 0.3800),
        ('IPCA',  '2025-11-01'::date, 0.3300),
        ('IPCA',  '2025-12-01'::date, 0.4100),
        ('IPCA',  '2026-01-01'::date, 0.4500),
        ('IPCA',  '2026-02-01'::date, 0.3900),
        ('IPCA',  '2026-03-01'::date, 0.3600),
        ('IPCA',  '2026-04-01'::date, 0.3400),
        ('IPCA',  '2026-05-01'::date, 0.3200),
        ('IPCA',  '2026-06-01'::date, 0.3100),
        ('IPCA',  '2026-07-01'::date, 0.3000)
    ) AS seed(indice, mes, valor)
    ON CONFLICT (indice, mes_referencia) DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO investimentos_snapshots (usuario_id, mes_referencia, patrimonio_total, total_aportado)
    SELECT
      u.usuario_id,
      m.month_start,
      COALESCE(SUM(
        CASE
          WHEN i.data_investimento > (m.month_start + interval '1 month' - interval '1 day')::date THEN 0
          ELSE ROUND(
            (
              i.valor_inicial
              + (i.valor_atual - i.valor_inicial)
              * LEAST(
                1,
                GREATEST(
                  0,
                  (
                    (m.month_start + interval '1 month' - interval '1 day')::date - i.data_investimento
                  )::numeric
                  / NULLIF((CURRENT_DATE - i.data_investimento)::numeric, 0)
                )
              )
            )::numeric,
            2
          )
        END
      ), 0) AS patrimonio_total,
      COALESCE(SUM(
        CASE
          WHEN i.data_investimento <= (m.month_start + interval '1 month' - interval '1 day')::date
          THEN i.valor_inicial
          ELSE 0
        END
      ), 0) AS total_aportado
    FROM (
      SELECT DISTINCT usuario_id FROM investimentos
    ) u
    CROSS JOIN (
      SELECT generate_series(
        date_trunc('month', CURRENT_DATE) - interval '11 months',
        date_trunc('month', CURRENT_DATE),
        interval '1 month'
      )::date AS month_start
    ) m
    LEFT JOIN investimentos i ON i.usuario_id = u.usuario_id
    GROUP BY u.usuario_id, m.month_start
    ON CONFLICT (usuario_id, mes_referencia) DO NOTHING;
  `);
}

async function migrateAnalyticsViews() {
  await pool.query(`
    CREATE OR REPLACE VIEW vw_analytics_movimentacoes AS
    SELECT
      m.id,
      m.usuario_id,
      m.conta_id,
      m.categoria_id,
      m.tipo,
      m.status,
      m.valor,
      m.descricao,
      m.data_transacao,
      m.data_competencia,
      m.cartao_id,
      m.fatura_id,
      m.parcela_atual,
      m.total_parcelas,
      m.forma_pagamento,
      m.recorrente,
      m.created_at,
      COALESCE(c.nome, 'Outros') AS categoria_nome,
      COALESCE(c.cor, '#94a3b8') AS categoria_cor,
      COALESCE(c.icone, 'wallet') AS categoria_icone,
      (m.status IN ('confirmada', 'paga')) AS liquidado,
      (m.tipo = 'receita') AS is_receita,
      (m.tipo IN ('despesa', 'recorrencia', 'compra_parcelada')) AS is_despesa,
      (m.tipo = 'receita' AND m.status IN ('confirmada', 'paga')) AS is_receita_liquidada,
      (
        m.tipo IN ('despesa', 'recorrencia', 'compra_parcelada')
        AND m.status IN ('confirmada', 'paga', 'pendente')
      ) AS is_despesa_periodo
    FROM movimentacoes m
    LEFT JOIN categorias c ON c.id = m.categoria_id;

    CREATE OR REPLACE VIEW vw_analytics_patrimonio AS
    SELECT
      u.id AS usuario_id,
      COALESCE(SUM(ct.saldo_atual) FILTER (WHERE ct.status = 'ativa'), 0) AS saldo_contas,
      COALESCE(inv.total_investimentos, 0) AS total_investimentos,
      COALESCE(SUM(ct.saldo_atual) FILTER (WHERE ct.status = 'ativa'), 0)
        + COALESCE(inv.total_investimentos, 0) AS patrimonio_total
    FROM usuarios u
    LEFT JOIN contas ct ON ct.usuario_id = u.id
    LEFT JOIN (
      SELECT usuario_id, SUM(valor_atual) AS total_investimentos
      FROM investimentos
      GROUP BY usuario_id
    ) inv ON inv.usuario_id = u.id
    GROUP BY u.id, inv.total_investimentos;

    CREATE OR REPLACE VIEW vw_analytics_cartoes AS
    SELECT
      c.id,
      c.usuario_id,
      c.nome,
      c.bandeira,
      c.cor,
      c.ultimos_digitos,
      c.limite_total,
      c.limite_disponivel,
      GREATEST(c.limite_total - c.limite_disponivel, 0) AS limite_utilizado,
      c.dia_fechamento,
      c.dia_vencimento,
      c.created_at,
      f.id AS fatura_atual_id,
      f.mes_referencia AS fatura_mes_referencia,
      f.valor_total AS fatura_atual_total,
      f.data_vencimento AS fatura_atual_vencimento,
      f.status AS fatura_atual_status
    FROM cartoes c
    LEFT JOIN faturas f
      ON f.cartao_id = c.id
      AND f.mes_referencia = date_trunc('month', CURRENT_DATE)::date;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mov_analytics_period
      ON movimentacoes (usuario_id, data_transacao DESC);

    CREATE INDEX IF NOT EXISTS idx_mov_pendentes
      ON movimentacoes (usuario_id, data_transacao)
      WHERE status = 'pendente';

    CREATE INDEX IF NOT EXISTS idx_faturas_cartao_mes
      ON faturas (cartao_id, mes_referencia);

    CREATE INDEX IF NOT EXISTS idx_parcelas_vencimento
      ON parcelas (data_vencimento)
      WHERE status IS DISTINCT FROM 'paga';
  `);
}

async function migratePersonalization() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS perfil_financeiro (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
      perfil_tipo VARCHAR(30) NOT NULL DEFAULT 'equilibrado',
      fonte_renda VARCHAR(40),
      renda_mensal NUMERIC(14,2) NOT NULL DEFAULT 0,
      alocacao_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      notificacoes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      onboarding_concluido BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT chk_perfil_financeiro_tipo CHECK (
        perfil_tipo IN ('equilibrado', 'conquistador', 'aproveitador', 'custom')
      ),
      CONSTRAINT chk_perfil_financeiro_renda CHECK (renda_mensal >= 0)
    );

    CREATE TABLE IF NOT EXISTS regras_orcamento (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      chave VARCHAR(40) NOT NULL,
      label VARCHAR(80) NOT NULL,
      percentual NUMERIC(7,2) NOT NULL,
      valor_limite NUMERIC(14,2) NOT NULL,
      valor_utilizado NUMERIC(14,2) NOT NULL DEFAULT 0,
      mes_referencia DATE NOT NULL,
      cor VARCHAR(7) DEFAULT '#0d6efd',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_regras_orcamento_usuario_chave_mes UNIQUE (usuario_id, chave, mes_referencia),
      CONSTRAINT chk_regras_orcamento_mes CHECK (date_trunc('month', mes_referencia)::date = mes_referencia),
      CONSTRAINT chk_regras_orcamento_percentual CHECK (percentual >= 0 AND percentual <= 100),
      CONSTRAINT chk_regras_orcamento_limite CHECK (valor_limite >= 0),
      CONSTRAINT chk_regras_orcamento_utilizado CHECK (valor_utilizado >= 0)
    );

    CREATE TABLE IF NOT EXISTS historico_saude_financeira (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      pontuacao NUMERIC(5,2) NOT NULL,
      fatores_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      registrado_em DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_historico_saude_usuario_dia UNIQUE (usuario_id, registrado_em),
      CONSTRAINT chk_historico_saude_pontuacao CHECK (pontuacao >= 0 AND pontuacao <= 100)
    );

    CREATE INDEX IF NOT EXISTS idx_regras_orcamento_usuario_mes
      ON regras_orcamento (usuario_id, mes_referencia);

    CREATE INDEX IF NOT EXISTS idx_historico_saude_usuario_data
      ON historico_saude_financeira (usuario_id, registrado_em DESC);
  `);

  await pool.query(`
    DROP TRIGGER IF EXISTS trg_perfil_financeiro_updated_at ON perfil_financeiro;
    CREATE TRIGGER trg_perfil_financeiro_updated_at
      BEFORE UPDATE ON perfil_financeiro
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    DROP TRIGGER IF EXISTS trg_regras_orcamento_updated_at ON regras_orcamento;
    CREATE TRIGGER trg_regras_orcamento_updated_at
      BEFORE UPDATE ON regras_orcamento
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
}

module.exports = { runMigrations };
