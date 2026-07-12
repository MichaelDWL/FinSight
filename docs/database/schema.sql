-- ============================================================
-- FinSight - Modelo relacional PostgreSQL
-- Banco: PostgreSQL
-- Extensao: pgcrypto para gen_random_uuid()
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extensoes
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 2. Tipos ENUM
-- ------------------------------------------------------------
CREATE TYPE tipo_transacao_enum AS ENUM (
    'receita',
    'despesa',
    'transferencia',
    'pagamento_fatura',
    'compra_parcelada',
    'recorrencia'
);

CREATE TYPE tipo_conta_enum AS ENUM (
    'corrente',
    'poupanca',
    'investimento',
    'carteira',
    'dinheiro',
    'outros'
);

CREATE TYPE status_enum AS ENUM (
    'ativa',
    'inativa',
    'pendente',
    'confirmada',
    'cancelada',
    'aberta',
    'fechada',
    'paga',
    'atrasada'
);

CREATE TYPE forma_pagamento_enum AS ENUM (
    'dinheiro',
    'pix',
    'debito',
    'credito',
    'boleto',
    'transferencia',
    'cartao_credito',
    'outros'
);

-- Origem da movimentacao: como ela foi criada no sistema.
CREATE TYPE origem_movimentacao_enum AS ENUM (
    'manual',
    'recorrente',
    'cartao',
    'transferencia'
);

-- Intervalo de recorrencia utilizado para gerar movimentacoes automaticamente.
CREATE TYPE intervalo_recorrencia_enum AS ENUM (
    'diario',
    'semanal',
    'mensal',
    'anual'
);

-- ------------------------------------------------------------
-- 3. Funcao e triggers de updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 4. Tabelas principais
-- ------------------------------------------------------------
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    status status_enum NOT NULL DEFAULT 'ativa',
    ultimo_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_usuarios_email_formato
        CHECK (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
    CONSTRAINT chk_usuarios_status
        CHECK (status IN ('ativa', 'inativa'))
);

CREATE TABLE contas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    tipo tipo_conta_enum NOT NULL,
    instituicao VARCHAR(120),
    saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
    saldo_atual NUMERIC(14,2) NOT NULL DEFAULT 0,
    cor VARCHAR(7),
    icone VARCHAR(80),
    observacao TEXT,
    status status_enum NOT NULL DEFAULT 'ativa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_contas_usuario_nome UNIQUE (usuario_id, nome),
    CONSTRAINT chk_contas_cor_hex CHECK (cor IS NULL OR cor ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_contas_status CHECK (status IN ('ativa', 'inativa'))
);

CREATE TABLE categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    icone VARCHAR(80),
    cor VARCHAR(7),
    tipo tipo_transacao_enum NOT NULL,
    status status_enum NOT NULL DEFAULT 'ativa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_categorias_usuario_nome_tipo UNIQUE (usuario_id, nome, tipo),
    CONSTRAINT chk_categorias_tipo CHECK (tipo IN ('receita', 'despesa')),
    CONSTRAINT chk_categorias_cor_hex CHECK (cor IS NULL OR cor ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_categorias_status CHECK (status IN ('ativa', 'inativa'))
);

-- Categorias globais de investimentos.
-- Ficam em tabela propria para permitir novos tipos sem alterar a estrutura do banco.
CREATE TABLE categorias_investimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(120) NOT NULL,
    icone VARCHAR(80),
    cor VARCHAR(7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_categorias_investimentos_nome UNIQUE (nome),
    CONSTRAINT chk_categorias_investimentos_cor_hex CHECK (cor IS NULL OR cor ~ '^#[0-9A-Fa-f]{6}$')
);

-- Cadastro simples de investimentos do usuario.
-- O lucro/prejuizo e a rentabilidade sao derivados de valor_inicial e valor_atual.
CREATE TABLE investimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    categoria_id UUID NOT NULL REFERENCES categorias_investimentos(id) ON DELETE RESTRICT,
    nome VARCHAR(120) NOT NULL,
    instituicao VARCHAR(120),
    valor_inicial NUMERIC(14,2) NOT NULL,
    valor_atual NUMERIC(14,2) NOT NULL,
    data_investimento DATE NOT NULL,
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_investimentos_valor_inicial CHECK (valor_inicial > 0),
    CONSTRAINT chk_investimentos_valor_atual CHECK (valor_atual >= 0)
);

CREATE TABLE cartoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    conta_pagamento_id UUID REFERENCES contas(id) ON DELETE SET NULL,
    nome VARCHAR(120) NOT NULL,
    banco VARCHAR(120),
    bandeira VARCHAR(40) NOT NULL,
    ultimos_digitos CHAR(3),
    limite_total NUMERIC(14,2) NOT NULL,
    limite_disponivel NUMERIC(14,2) NOT NULL,
    dia_fechamento SMALLINT NOT NULL,
    dia_vencimento SMALLINT NOT NULL,
    cor VARCHAR(7) DEFAULT '#0d6efd',
    observacao TEXT,
    status status_enum NOT NULL DEFAULT 'ativa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_cartoes_usuario_nome UNIQUE (usuario_id, nome),
    CONSTRAINT chk_cartoes_limite_total CHECK (limite_total > 0),
    CONSTRAINT chk_cartoes_limite_disponivel CHECK (limite_disponivel >= 0 AND limite_disponivel <= limite_total),
    CONSTRAINT chk_cartoes_dia_fechamento CHECK (dia_fechamento BETWEEN 1 AND 31),
    CONSTRAINT chk_cartoes_dia_vencimento CHECK (dia_vencimento BETWEEN 1 AND 31),
    CONSTRAINT chk_cartoes_cor_hex CHECK (cor IS NULL OR cor ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_cartoes_ultimos_digitos CHECK (ultimos_digitos IS NULL OR ultimos_digitos ~ '^[0-9]{3}$'),
    CONSTRAINT chk_cartoes_status CHECK (status IN ('ativa', 'inativa'))
);

CREATE TABLE faturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    cartao_id UUID NOT NULL REFERENCES cartoes(id) ON DELETE CASCADE,
    mes_referencia DATE NOT NULL,
    data_fechamento DATE NOT NULL,
    data_vencimento DATE NOT NULL,
    valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    valor_pago NUMERIC(14,2) NOT NULL DEFAULT 0,
    status status_enum NOT NULL DEFAULT 'aberta',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_faturas_cartao_mes UNIQUE (cartao_id, mes_referencia),
    CONSTRAINT chk_faturas_mes_primeiro_dia CHECK (date_trunc('month', mes_referencia)::date = mes_referencia),
    CONSTRAINT chk_faturas_valores CHECK (valor_total >= 0 AND valor_pago >= 0 AND valor_pago <= valor_total),
    CONSTRAINT chk_faturas_datas CHECK (data_vencimento >= data_fechamento),
    CONSTRAINT chk_faturas_status CHECK (status IN ('aberta', 'fechada', 'paga', 'atrasada'))
);

CREATE TABLE movimentacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    conta_id UUID REFERENCES contas(id) ON DELETE RESTRICT,
    conta_destino_id UUID REFERENCES contas(id) ON DELETE RESTRICT,
    categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
    cartao_id UUID REFERENCES cartoes(id) ON DELETE SET NULL,
    fatura_id UUID REFERENCES faturas(id) ON DELETE SET NULL,
    movimentacao_pai_id UUID REFERENCES movimentacoes(id) ON DELETE SET NULL,
    recorrencia_id UUID,
    tipo tipo_transacao_enum NOT NULL,
    origem origem_movimentacao_enum NOT NULL DEFAULT 'manual',
    forma_pagamento forma_pagamento_enum NOT NULL,
    status status_enum NOT NULL DEFAULT 'confirmada',
    descricao VARCHAR(180) NOT NULL,
    valor NUMERIC(14,2) NOT NULL,
    data_transacao DATE NOT NULL,
    data_competencia DATE NOT NULL DEFAULT CURRENT_DATE,
    recorrente BOOLEAN NOT NULL DEFAULT false,
    recorrencia_intervalo VARCHAR(20),
    recorrencia_ate DATE,
    parcela_atual INTEGER,
    total_parcelas INTEGER,
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_movimentacoes_valor CHECK (valor > 0),
    CONSTRAINT chk_movimentacoes_status CHECK (status IN ('pendente', 'confirmada', 'cancelada', 'paga')),
    CONSTRAINT chk_movimentacoes_transferencia
        CHECK (tipo <> 'transferencia' OR (conta_id IS NOT NULL AND conta_destino_id IS NOT NULL AND conta_destino_id <> conta_id)),
    CONSTRAINT chk_movimentacoes_pagamento_fatura
        CHECK (tipo <> 'pagamento_fatura' OR fatura_id IS NOT NULL),
    CONSTRAINT chk_movimentacoes_compra_parcelada
        CHECK (tipo <> 'compra_parcelada' OR (cartao_id IS NOT NULL AND total_parcelas IS NOT NULL AND total_parcelas > 1)),
    CONSTRAINT chk_movimentacoes_recorrencia
        CHECK (tipo <> 'recorrencia' OR recorrente = true),
    CONSTRAINT chk_movimentacoes_parcelas_total CHECK (total_parcelas IS NULL OR total_parcelas >= 1),
    CONSTRAINT chk_movimentacoes_parcela_atual
        CHECK (parcela_atual IS NULL OR (total_parcelas IS NOT NULL AND parcela_atual BETWEEN 1 AND total_parcelas))
);

CREATE TABLE parcelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    movimentacao_id UUID NOT NULL REFERENCES movimentacoes(id) ON DELETE CASCADE,
    fatura_id UUID REFERENCES faturas(id) ON DELETE SET NULL,
    numero INTEGER NOT NULL,
    total INTEGER NOT NULL,
    valor NUMERIC(14,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    status status_enum NOT NULL DEFAULT 'pendente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_parcelas_movimentacao_numero UNIQUE (movimentacao_id, numero),
    CONSTRAINT chk_parcelas_numero CHECK (numero BETWEEN 1 AND total),
    CONSTRAINT chk_parcelas_total CHECK (total > 1),
    CONSTRAINT chk_parcelas_valor CHECK (valor > 0),
    CONSTRAINT chk_parcelas_status CHECK (status IN ('pendente', 'paga', 'cancelada'))
);

-- Modelos de recorrencia. Responsaveis por gerar automaticamente as
-- proximas movimentacoes (ex.: contas mensais como energia, internet, aluguel).
CREATE TABLE recorrencias (
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
);

-- Vinculo opcional da movimentacao com a recorrencia que a gerou.
ALTER TABLE movimentacoes
    ADD CONSTRAINT fk_movimentacoes_recorrencia
    FOREIGN KEY (recorrencia_id) REFERENCES recorrencias(id) ON DELETE SET NULL;

CREATE TABLE metas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    valor_alvo NUMERIC(14,2) NOT NULL,
    valor_atual NUMERIC(14,2) NOT NULL DEFAULT 0,
    percentual NUMERIC(7,2) GENERATED ALWAYS AS (
        CASE
            WHEN valor_alvo > 0 THEN round((valor_atual / valor_alvo) * 100, 2)
            ELSE 0
        END
    ) STORED,
    prazo DATE NOT NULL,
    status status_enum NOT NULL DEFAULT 'ativa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_metas_usuario_nome UNIQUE (usuario_id, nome),
    CONSTRAINT chk_metas_valor_alvo CHECK (valor_alvo > 0),
    CONSTRAINT chk_metas_valor_atual CHECK (valor_atual >= 0),
    CONSTRAINT chk_metas_status CHECK (status IN ('ativa', 'inativa', 'confirmada', 'cancelada'))
);

CREATE TABLE orcamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    mes_referencia DATE NOT NULL,
    valor_limite NUMERIC(14,2) NOT NULL,
    valor_utilizado NUMERIC(14,2) NOT NULL DEFAULT 0,
    percentual NUMERIC(7,2) GENERATED ALWAYS AS (
        CASE
            WHEN valor_limite > 0 THEN round((valor_utilizado / valor_limite) * 100, 2)
            ELSE 0
        END
    ) STORED,
    status status_enum NOT NULL DEFAULT 'ativa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_orcamentos_usuario_categoria_mes UNIQUE (usuario_id, categoria_id, mes_referencia),
    CONSTRAINT chk_orcamentos_mes_primeiro_dia CHECK (date_trunc('month', mes_referencia)::date = mes_referencia),
    CONSTRAINT chk_orcamentos_valor_limite CHECK (valor_limite > 0),
    CONSTRAINT chk_orcamentos_valor_utilizado CHECK (valor_utilizado >= 0),
    CONSTRAINT chk_orcamentos_status CHECK (status IN ('ativa', 'inativa'))
);

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(80) NOT NULL,
    cor VARCHAR(7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_tags_usuario_nome UNIQUE (usuario_id, nome),
    CONSTRAINT chk_tags_cor_hex CHECK (cor IS NULL OR cor ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE movimentacao_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movimentacao_id UUID NOT NULL REFERENCES movimentacoes(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_movimentacao_tags_transacao_tag UNIQUE (movimentacao_id, tag_id)
);

CREATE TABLE anexos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    movimentacao_id UUID NOT NULL REFERENCES movimentacoes(id) ON DELETE CASCADE,
    nome_arquivo VARCHAR(180) NOT NULL,
    url TEXT NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    tamanho_bytes BIGINT NOT NULL,
    status status_enum NOT NULL DEFAULT 'ativa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_anexos_tamanho CHECK (tamanho_bytes > 0),
    CONSTRAINT chk_anexos_status CHECK (status IN ('ativa', 'inativa'))
);

CREATE TABLE notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo VARCHAR(140) NOT NULL,
    mensagem TEXT NOT NULL,
    tipo VARCHAR(60) NOT NULL,
    lida BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_notificacoes_tipo CHECK (tipo IN ('sistema', 'orcamento', 'meta', 'fatura', 'transacao'))
);

CREATE TABLE configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    tema VARCHAR(20) NOT NULL DEFAULT 'claro',
    idioma VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    moeda CHAR(3) NOT NULL DEFAULT 'BRL',
    formato_data VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
    fuso_horario VARCHAR(80) NOT NULL DEFAULT 'America/Sao_Paulo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_configuracoes_tema CHECK (tema IN ('claro', 'escuro', 'sistema')),
    CONSTRAINT chk_configuracoes_moeda CHECK (moeda ~ '^[A-Z]{3}$')
);

-- ------------------------------------------------------------
-- 5. Triggers de atualizacao de updated_at
-- ------------------------------------------------------------
CREATE TRIGGER trg_usuarios_updated_at BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_contas_updated_at BEFORE UPDATE ON contas
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_categorias_updated_at BEFORE UPDATE ON categorias
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_categorias_investimentos_updated_at BEFORE UPDATE ON categorias_investimentos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_investimentos_updated_at BEFORE UPDATE ON investimentos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_cartoes_updated_at BEFORE UPDATE ON cartoes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_faturas_updated_at BEFORE UPDATE ON faturas
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_movimentacoes_updated_at BEFORE UPDATE ON movimentacoes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_parcelas_updated_at BEFORE UPDATE ON parcelas
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_recorrencias_updated_at BEFORE UPDATE ON recorrencias
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_metas_updated_at BEFORE UPDATE ON metas
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orcamentos_updated_at BEFORE UPDATE ON orcamentos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tags_updated_at BEFORE UPDATE ON tags
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_movimentacao_tags_updated_at BEFORE UPDATE ON movimentacao_tags
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_anexos_updated_at BEFORE UPDATE ON anexos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_notificacoes_updated_at BEFORE UPDATE ON notificacoes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_configuracoes_updated_at BEFORE UPDATE ON configuracoes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 6. Indices para consultas frequentes
-- ------------------------------------------------------------
CREATE INDEX idx_usuarios_email_lower ON usuarios (lower(email));

CREATE INDEX idx_contas_usuario_status ON contas (usuario_id, status);
CREATE INDEX idx_contas_usuario_tipo ON contas (usuario_id, tipo);

CREATE INDEX idx_categorias_usuario_tipo_status ON categorias (usuario_id, tipo, status);

CREATE INDEX idx_categorias_investimentos_nome ON categorias_investimentos (nome);
CREATE INDEX idx_investimentos_usuario_data ON investimentos (usuario_id, data_investimento DESC);
CREATE INDEX idx_investimentos_usuario_categoria ON investimentos (usuario_id, categoria_id);
CREATE INDEX idx_investimentos_categoria ON investimentos (categoria_id);

CREATE INDEX idx_cartoes_usuario_status ON cartoes (usuario_id, status);
CREATE INDEX idx_cartoes_conta_pagamento ON cartoes (conta_pagamento_id);

CREATE INDEX idx_faturas_usuario_status ON faturas (usuario_id, status);
CREATE INDEX idx_faturas_cartao_vencimento ON faturas (cartao_id, data_vencimento);

CREATE INDEX idx_movimentacoes_usuario_data ON movimentacoes (usuario_id, data_transacao DESC);
CREATE INDEX idx_movimentacoes_usuario_tipo_data ON movimentacoes (usuario_id, tipo, data_transacao DESC);
CREATE INDEX idx_movimentacoes_conta_data ON movimentacoes (conta_id, data_transacao DESC);
CREATE INDEX idx_movimentacoes_conta_destino ON movimentacoes (conta_destino_id);
CREATE INDEX idx_movimentacoes_categoria_data ON movimentacoes (categoria_id, data_transacao DESC);
CREATE INDEX idx_movimentacoes_cartao ON movimentacoes (cartao_id);
CREATE INDEX idx_movimentacoes_fatura ON movimentacoes (fatura_id);
CREATE INDEX idx_movimentacoes_pai ON movimentacoes (movimentacao_pai_id);
CREATE INDEX idx_movimentacoes_recorrentes ON movimentacoes (usuario_id, recorrencia_ate)
WHERE recorrente = true;
CREATE INDEX idx_movimentacoes_usuario_origem ON movimentacoes (usuario_id, origem);
CREATE INDEX idx_movimentacoes_recorrencia ON movimentacoes (recorrencia_id);

CREATE INDEX idx_parcelas_usuario_vencimento ON parcelas (usuario_id, data_vencimento);
CREATE INDEX idx_parcelas_fatura_status ON parcelas (fatura_id, status);

CREATE INDEX idx_recorrencias_usuario_ativa ON recorrencias (usuario_id, ativa);
CREATE INDEX idx_recorrencias_proxima_geracao ON recorrencias (proxima_geracao) WHERE ativa = true;

CREATE INDEX idx_metas_usuario_status ON metas (usuario_id, status);
CREATE INDEX idx_metas_usuario_prazo ON metas (usuario_id, prazo);

CREATE INDEX idx_orcamentos_usuario_mes ON orcamentos (usuario_id, mes_referencia);
CREATE INDEX idx_orcamentos_categoria_mes ON orcamentos (categoria_id, mes_referencia);

CREATE INDEX idx_tags_usuario_nome ON tags (usuario_id, nome);
CREATE INDEX idx_movimentacao_tags_tag ON movimentacao_tags (tag_id);

CREATE INDEX idx_anexos_movimentacao ON anexos (movimentacao_id);
CREATE INDEX idx_notificacoes_usuario_lida ON notificacoes (usuario_id, lida, created_at DESC);

-- ------------------------------------------------------------
-- 7. Carga inicial de exemplo
-- ------------------------------------------------------------

-- 7.1 Usuario de exemplo
INSERT INTO usuarios (id, nome, email, senha_hash, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Maria Silva',
    'maria.silva@finsight.local',
    '$2b$12$hash.exemplo.apenas.para.seed',
    'ativa'
);

-- Configuracao padrao do usuario de exemplo.
INSERT INTO configuracoes (id, usuario_id, tema, idioma, moeda, formato_data, fuso_horario)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'claro',
    'pt-BR',
    'BRL',
    'DD/MM/YYYY',
    'America/Sao_Paulo'
);

-- 7.2 Dez categorias padrao
INSERT INTO categorias (id, usuario_id, nome, icone, cor, tipo)
VALUES
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Salario', 'briefcase', '#2ECC71', 'receita'),
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Freelance', 'laptop', '#27AE60', 'receita'),
    ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Investimentos', 'trending-up', '#16A085', 'receita'),
    ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Moradia', 'home', '#3498DB', 'despesa'),
    ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Alimentacao', 'shopping-cart', '#E67E22', 'despesa'),
    ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Transporte', 'car', '#9B59B6', 'despesa'),
    ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Saude', 'heart', '#E74C3C', 'despesa'),
    ('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Lazer', 'gamepad', '#F1C40F', 'despesa'),
    ('20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Educacao', 'book-open', '#8E44AD', 'despesa'),
    ('20000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Assinaturas', 'repeat', '#95A5A6', 'despesa');

-- 7.3 Categorias padrao de investimentos
INSERT INTO categorias_investimentos (id, nome, icone, cor)
VALUES
    ('80000000-0000-0000-0000-000000000001', 'Poupanca', 'piggy-bank', '#2ECC71'),
    ('80000000-0000-0000-0000-000000000002', 'CDB', 'landmark', '#3498DB'),
    ('80000000-0000-0000-0000-000000000003', 'Tesouro Direto', 'shield-check', '#F1C40F'),
    ('80000000-0000-0000-0000-000000000004', 'Fundo Imobiliario', 'building-2', '#E67E22'),
    ('80000000-0000-0000-0000-000000000005', 'Acoes', 'trending-up', '#9B59B6'),
    ('80000000-0000-0000-0000-000000000006', 'ETF', 'layers', '#1ABC9C'),
    ('80000000-0000-0000-0000-000000000007', 'Criptomoedas', 'bitcoin', '#F39C12'),
    ('80000000-0000-0000-0000-000000000008', 'Previdencia Privada', 'umbrella', '#34495E'),
    ('80000000-0000-0000-0000-000000000009', 'Fundo de Investimento', 'briefcase', '#16A085'),
    ('80000000-0000-0000-0000-000000000010', 'Outros', 'circle-dollar-sign', '#95A5A6');

-- 7.4 Investimentos de exemplo
INSERT INTO investimentos (
    id, usuario_id, categoria_id, nome, instituicao, valor_inicial,
    valor_atual, data_investimento, observacao
)
VALUES
    ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', 'CDB Liquidez Diaria', 'Banco Exemplo', 3000.00, 3185.40, '2026-01-12', 'Reserva com resgate rapido.'),
    ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000003', 'Tesouro Selic 2029', 'Tesouro Direto', 2500.00, 2578.30, '2026-01-20', 'Investimento conservador.'),
    ('90000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000004', 'FII Renda Urbana', 'Corretora Exemplo', 1200.00, 1165.00, '2026-02-03', 'Exemplo com oscilacao negativa.'),
    ('90000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000007', 'Bitcoin', 'Exchange Exemplo', 800.00, 920.00, '2026-02-14', 'Pequena exposicao a cripto.');

-- 7.5 Duas contas
INSERT INTO contas (id, usuario_id, nome, tipo, saldo_inicial, saldo_atual, cor, icone)
VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Conta Corrente Principal', 'corrente', 2500.00, 6840.00, '#1F77B4', 'bank'),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Reserva de Emergencia', 'poupanca', 8000.00, 8800.00, '#2CA02C', 'piggy-bank');

-- 7.6 Um cartao de credito
INSERT INTO cartoes (id, usuario_id, conta_pagamento_id, nome, banco, bandeira, ultimos_digitos, limite_total, limite_disponivel, dia_fechamento, dia_vencimento)
VALUES (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Cartao Gold',
    'Banco Exemplo',
    'Visa',
    '001',
    8000.00,
    5360.00,
    20,
    28
);

-- 7.7 Duas faturas
INSERT INTO faturas (id, usuario_id, cartao_id, mes_referencia, data_fechamento, data_vencimento, valor_total, valor_pago, status)
VALUES
    ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '2026-01-01', '2026-01-20', '2026-01-28', 1280.00, 1280.00, 'paga'),
    ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '2026-02-01', '2026-02-20', '2026-02-28', 1640.00, 0.00, 'aberta');

-- 7.8 Trinta movimentacoes cobrindo receitas, despesas, transferencias, faturas, parcelamentos e recorrencias
INSERT INTO movimentacoes (
    id, usuario_id, conta_id, conta_destino_id, categoria_id, cartao_id, fatura_id,
    movimentacao_pai_id, tipo, forma_pagamento, status, descricao, valor, data_transacao,
    data_competencia, recorrente, recorrencia_intervalo, recorrencia_ate, parcela_atual,
    total_parcelas, observacao
)
VALUES
    ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000001', NULL, NULL, NULL, 'receita', 'pix', 'confirmada', 'Salario janeiro', 6500.00, '2026-01-05', '2026-01-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000002', NULL, NULL, NULL, 'receita', 'pix', 'confirmada', 'Projeto freelance landing page', 1200.00, '2026-01-10', '2026-01-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000003', NULL, NULL, NULL, 'receita', 'transferencia', 'confirmada', 'Rendimento CDB', 85.30, '2026-01-15', '2026-01-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000004', NULL, NULL, NULL, 'despesa', 'boleto', 'confirmada', 'Aluguel janeiro', 1800.00, '2026-01-06', '2026-01-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000005', NULL, NULL, NULL, 'despesa', 'debito', 'confirmada', 'Supermercado semanal', 342.80, '2026-01-07', '2026-01-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000006', NULL, NULL, NULL, 'despesa', 'pix', 'confirmada', 'Combustivel', 210.00, '2026-01-08', '2026-01-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000007', NULL, NULL, NULL, 'despesa', 'pix', 'confirmada', 'Consulta medica', 280.00, '2026-01-09', '2026-01-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000008', NULL, NULL, NULL, 'despesa', 'pix', 'confirmada', 'Cinema', 96.00, '2026-01-12', '2026-01-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000009', NULL, NULL, NULL, 'despesa', 'pix', 'confirmada', 'Curso online', 149.90, '2026-01-14', '2026-01-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000010', NULL, NULL, NULL, 'recorrencia', 'credito', 'confirmada', 'Streaming mensal', 39.90, '2026-01-15', '2026-01-01', true, 'mensal', '2026-12-15', NULL, NULL, 'Conta recorrente mensal'),
    ('70000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', NULL, NULL, NULL, NULL, 'transferencia', 'transferencia', 'confirmada', 'Aporte para reserva', 800.00, '2026-01-16', '2026-01-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', NULL, NULL, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', NULL, 'compra_parcelada', 'cartao_credito', 'confirmada', 'Smartphone parcela 1 de 5', 520.00, '2026-01-18', '2026-01-01', false, NULL, NULL, 1, 5, NULL),
    ('70000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', NULL, NULL, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', NULL, 'despesa', 'cartao_credito', 'confirmada', 'Restaurante', 186.40, '2026-01-19', '2026-01-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, NULL, NULL, '40000000-0000-0000-0000-000000000001', NULL, 'pagamento_fatura', 'transferencia', 'paga', 'Pagamento fatura janeiro', 1280.00, '2026-01-28', '2026-01-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000001', NULL, NULL, NULL, 'receita', 'pix', 'confirmada', 'Salario fevereiro', 6500.00, '2026-02-05', '2026-02-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000002', NULL, NULL, NULL, 'receita', 'pix', 'confirmada', 'Manutencao site cliente', 900.00, '2026-02-09', '2026-02-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000004', NULL, NULL, NULL, 'despesa', 'boleto', 'confirmada', 'Aluguel fevereiro', 1800.00, '2026-02-06', '2026-02-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000005', NULL, NULL, NULL, 'despesa', 'debito', 'confirmada', 'Supermercado mensal', 612.45, '2026-02-07', '2026-02-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000006', NULL, NULL, NULL, 'despesa', 'pix', 'confirmada', 'Aplicativo transporte', 78.20, '2026-02-08', '2026-02-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000007', NULL, NULL, NULL, 'despesa', 'debito', 'confirmada', 'Farmacia', 134.70, '2026-02-10', '2026-02-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000010', NULL, NULL, NULL, 'recorrencia', 'credito', 'confirmada', 'Academia mensal', 119.90, '2026-02-10', '2026-02-01', true, 'mensal', '2026-12-10', NULL, NULL, 'Conta recorrente mensal'),
    ('70000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', NULL, NULL, NULL, NULL, 'transferencia', 'transferencia', 'confirmada', 'Reforco reserva emergencia', 500.00, '2026-02-11', '2026-02-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', NULL, NULL, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000012', 'compra_parcelada', 'cartao_credito', 'confirmada', 'Smartphone parcela 2 de 5', 520.00, '2026-02-18', '2026-02-01', false, NULL, NULL, 2, 5, NULL),
    ('70000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000001', NULL, NULL, '20000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', NULL, 'compra_parcelada', 'cartao_credito', 'confirmada', 'Notebook curso parcela 1 de 4', 680.00, '2026-02-19', '2026-02-01', false, NULL, NULL, 1, 4, NULL),
    ('70000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000001', NULL, NULL, '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', NULL, 'despesa', 'cartao_credito', 'confirmada', 'Padaria e cafe', 48.50, '2026-02-20', '2026-02-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000001', NULL, NULL, '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', NULL, 'despesa', 'cartao_credito', 'confirmada', 'Show', 260.00, '2026-02-21', '2026-02-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000027', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000003', NULL, NULL, NULL, 'receita', 'transferencia', 'confirmada', 'Dividendos', 112.30, '2026-02-22', '2026-02-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000028', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000010', NULL, NULL, NULL, 'recorrencia', 'credito', 'confirmada', 'Software financeiro mensal', 59.90, '2026-02-24', '2026-02-01', true, 'mensal', '2026-12-24', NULL, NULL, 'Conta recorrente mensal'),
    ('70000000-0000-0000-0000-000000000029', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000006', NULL, NULL, NULL, 'despesa', 'pix', 'pendente', 'IPVA parcela', 410.00, '2026-02-25', '2026-02-01', false, NULL, NULL, NULL, NULL, NULL),
    ('70000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, NULL, NULL, '40000000-0000-0000-0000-000000000002', NULL, 'pagamento_fatura', 'transferencia', 'pendente', 'Pagamento fatura fevereiro', 1640.00, '2026-02-28', '2026-02-01', false, NULL, NULL, NULL, NULL, NULL);

-- 7.9 Duas metas financeiras
INSERT INTO metas (id, usuario_id, nome, valor_alvo, valor_atual, prazo, status)
VALUES
    ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Reserva de emergencia', 20000.00, 8800.00, '2026-12-31', 'ativa'),
    ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Viagem de ferias', 9000.00, 2300.00, '2026-11-15', 'ativa');

-- 7.10 Cinco notificacoes
INSERT INTO notificacoes (id, usuario_id, titulo, mensagem, tipo, lida)
VALUES
    ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Fatura aberta', 'Sua fatura de fevereiro esta aberta para acompanhamento.', 'fatura', false),
    ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Meta em progresso', 'Voce alcancou mais de 40% da meta Reserva de emergencia.', 'meta', false),
    ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Orcamento de alimentacao', 'Revise seus gastos de alimentacao deste mes.', 'orcamento', true),
    ('60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Pagamento pendente', 'Existe um pagamento de fatura marcado como pendente.', 'transacao', false),
    ('60000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Bem-vinda ao FinSight', 'Configure suas contas e acompanhe sua vida financeira em um so lugar.', 'sistema', true);

-- ------------------------------------------------------------
-- 8. Consultas uteis para o modulo de investimentos
-- ------------------------------------------------------------

-- 8.1 Resumo da carteira: total investido, valor atual, lucro, prejuizo, rentabilidade e quantidade.
-- Substitua :usuario_id pelo UUID do usuario autenticado.
SELECT
    COALESCE(sum(valor_inicial), 0) AS total_investido,
    COALESCE(sum(valor_atual), 0) AS valor_atual_carteira,
    COALESCE(sum(GREATEST(valor_atual - valor_inicial, 0)), 0) AS lucro_total,
    COALESCE(sum(GREATEST(valor_inicial - valor_atual, 0)), 0) AS prejuizo_total,
    CASE
        WHEN COALESCE(sum(valor_inicial), 0) > 0
            THEN round(((sum(valor_atual) - sum(valor_inicial)) / sum(valor_inicial)) * 100, 2)
        ELSE 0
    END AS rentabilidade_percentual,
    count(*) AS quantidade_investimentos
FROM investimentos
WHERE usuario_id = :usuario_id;

-- 8.2 Total investido.
SELECT
    COALESCE(sum(valor_inicial), 0) AS total_investido
FROM investimentos
WHERE usuario_id = :usuario_id;

-- 8.3 Lucro total, considerando apenas investimentos com ganho.
SELECT
    COALESCE(sum(valor_atual - valor_inicial), 0) AS lucro_total
FROM investimentos
WHERE usuario_id = :usuario_id
  AND valor_atual > valor_inicial;

-- 8.4 Investimentos por categoria.
SELECT
    ci.nome AS categoria,
    ci.icone,
    ci.cor,
    count(i.id) AS quantidade_investimentos,
    COALESCE(sum(i.valor_inicial), 0) AS total_investido,
    COALESCE(sum(i.valor_atual), 0) AS valor_atual,
    COALESCE(sum(i.valor_atual - i.valor_inicial), 0) AS resultado,
    CASE
        WHEN COALESCE(sum(i.valor_inicial), 0) > 0
            THEN round(((sum(i.valor_atual) - sum(i.valor_inicial)) / sum(i.valor_inicial)) * 100, 2)
        ELSE 0
    END AS rentabilidade_percentual
FROM categorias_investimentos ci
LEFT JOIN investimentos i
    ON i.categoria_id = ci.id
   AND i.usuario_id = :usuario_id
GROUP BY ci.id, ci.nome, ci.icone, ci.cor
ORDER BY ci.nome;

-- 8.5 Valor atual da carteira.
SELECT
    COALESCE(sum(valor_atual), 0) AS valor_atual_carteira
FROM investimentos
WHERE usuario_id = :usuario_id;

-- 8.6 Rentabilidade total da carteira.
SELECT
    CASE
        WHEN COALESCE(sum(valor_inicial), 0) > 0
            THEN round(((sum(valor_atual) - sum(valor_inicial)) / sum(valor_inicial)) * 100, 2)
        ELSE 0
    END AS rentabilidade_percentual
FROM investimentos
WHERE usuario_id = :usuario_id;
