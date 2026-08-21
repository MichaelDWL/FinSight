const pool = require("../../database/pool");
const { monthStart } = require("./constants");

function mapProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.usuario_id,
    profileType: row.perfil_tipo,
    incomeSource: row.fonte_renda,
    monthlyIncome: Number(row.renda_mensal) || 0,
    allocation: row.alocacao_json || {},
    notifications: row.notificacoes_json || [],
    onboardingCompleted: Boolean(row.onboarding_concluido),
    updatedAt: row.updated_at,
  };
}

function mapBudgetRule(row) {
  return {
    id: row.id,
    key: row.chave,
    label: row.label,
    percent: Number(row.percentual) || 0,
    limit: Number(row.valor_limite) || 0,
    used: Number(row.valor_utilizado) || 0,
    remaining: Math.max((Number(row.valor_limite) || 0) - (Number(row.valor_utilizado) || 0), 0),
    usagePercent:
      Number(row.valor_limite) > 0
        ? Math.round(((Number(row.valor_utilizado) || 0) / Number(row.valor_limite)) * 100)
        : 0,
    month: row.mes_referencia,
    color: row.cor || "#0d6efd",
  };
}

async function findProfile(userId) {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM perfil_financeiro
      WHERE usuario_id = $1
      LIMIT 1
    `,
    [userId],
  );
  return mapProfile(rows[0]);
}

async function upsertProfile(userId, payload) {
  const { rows } = await pool.query(
    `
      INSERT INTO perfil_financeiro (
        usuario_id, perfil_tipo, fonte_renda, renda_mensal,
        alocacao_json, notificacoes_json, onboarding_concluido
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
      ON CONFLICT (usuario_id) DO UPDATE SET
        perfil_tipo = EXCLUDED.perfil_tipo,
        fonte_renda = EXCLUDED.fonte_renda,
        renda_mensal = EXCLUDED.renda_mensal,
        alocacao_json = EXCLUDED.alocacao_json,
        notificacoes_json = EXCLUDED.notificacoes_json,
        onboarding_concluido = EXCLUDED.onboarding_concluido,
        updated_at = now()
      RETURNING *
    `,
    [
      userId,
      payload.profileType,
      payload.incomeSource || null,
      Number(payload.monthlyIncome) || 0,
      JSON.stringify(payload.allocation || {}),
      JSON.stringify(payload.notifications || []),
      Boolean(payload.onboardingCompleted),
    ],
  );
  return mapProfile(rows[0]);
}

async function replaceBudgetRules(userId, rules, referenceMonth = monthStart()) {
  await pool.query(
    `DELETE FROM regras_orcamento WHERE usuario_id = $1 AND mes_referencia = $2::date`,
    [userId, referenceMonth],
  );

  const created = [];
  for (const rule of rules) {
    const { rows } = await pool.query(
      `
        INSERT INTO regras_orcamento (
          usuario_id, chave, label, percentual, valor_limite,
          valor_utilizado, mes_referencia, cor
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8)
        RETURNING *
      `,
      [
        userId,
        rule.key,
        rule.label,
        rule.percent,
        rule.limit,
        rule.used || 0,
        referenceMonth,
        rule.color || "#0d6efd",
      ],
    );
    created.push(mapBudgetRule(rows[0]));
  }
  return created;
}

async function listBudgetRules(userId, referenceMonth = monthStart()) {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM regras_orcamento
      WHERE usuario_id = $1 AND mes_referencia = $2::date
      ORDER BY percentual DESC, label ASC
    `,
    [userId, referenceMonth],
  );
  return rows.map(mapBudgetRule);
}

async function updateBudgetUsage(userId, usageByKey = {}, referenceMonth = monthStart()) {
  const entries = Object.entries(usageByKey);
  for (const [key, used] of entries) {
    await pool.query(
      `
        UPDATE regras_orcamento
        SET valor_utilizado = $4, updated_at = now()
        WHERE usuario_id = $1 AND chave = $2 AND mes_referencia = $3::date
      `,
      [userId, key, referenceMonth, Number(used) || 0],
    );
  }
  return listBudgetRules(userId, referenceMonth);
}

async function upsertHealthScore(userId, score, factors, day = new Date()) {
  const dayIso = day.toISOString().slice(0, 10);
  const { rows } = await pool.query(
    `
      INSERT INTO historico_saude_financeira (
        usuario_id, pontuacao, fatores_json, registrado_em
      )
      VALUES ($1, $2, $3::jsonb, $4::date)
      ON CONFLICT (usuario_id, registrado_em) DO UPDATE SET
        pontuacao = EXCLUDED.pontuacao,
        fatores_json = EXCLUDED.fatores_json
      RETURNING *
    `,
    [userId, score, JSON.stringify(factors || {}), dayIso],
  );
  return {
    score: Number(rows[0].pontuacao),
    factors: rows[0].fatores_json,
    date: rows[0].registrado_em,
  };
}

async function listHealthHistory(userId, { days = 180 } = {}) {
  const { rows } = await pool.query(
    `
      SELECT pontuacao, fatores_json, registrado_em
      FROM historico_saude_financeira
      WHERE usuario_id = $1
        AND registrado_em >= CURRENT_DATE - ($2::int || ' days')::interval
      ORDER BY registrado_em ASC
    `,
    [userId, days],
  );
  return rows.map((row) => ({
    score: Number(row.pontuacao),
    factors: row.fatores_json,
    date: row.registrado_em,
  }));
}

async function getSpendingByCategory(userId, referenceMonth = monthStart()) {
  const { monthStart: start, nextMonth } = monthBounds(referenceMonth);

  const { rows } = await pool.query(
    `
      SELECT
        COALESCE(NULLIF(TRIM(c.nome), ''), 'Outros') AS category,
        COALESCE(SUM(m.valor), 0)::numeric AS total
      FROM movimentacoes m
      LEFT JOIN categorias c ON c.id = m.categoria_id
      WHERE m.usuario_id = $1
        AND m.tipo IN ('despesa', 'recorrencia', 'compra_parcelada', 'pagamento_fatura')
        AND m.status <> 'cancelada'
        AND m.data_transacao >= $2::date
        AND m.data_transacao < $3::date
      GROUP BY 1
      ORDER BY total DESC
    `,
    [userId, start, nextMonth],
  );
  return rows.map((row) => ({
    category: row.category,
    total: Number(row.total) || 0,
  }));
}

/**
 * Calcula bounds do mes a partir de YYYY-MM-DD (ou YYYY-MM-01).
 * Evita timezone: opera apenas sobre componentes de data civil.
 */
function monthBounds(referenceMonth = monthStart()) {
  const monthStartIso = String(referenceMonth).slice(0, 10);
  const [year, month] = monthStartIso.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    monthStart: `${year}-${String(month).padStart(2, "0")}-01`,
    nextMonth: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

function mapGoalsRows(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    name: row.nome,
    target: Number(row.valor_alvo) || 0,
    current: Number(row.valor_atual) || 0,
    deadline: row.prazo,
    remaining: Math.max((Number(row.valor_alvo) || 0) - (Number(row.valor_atual) || 0), 0),
    progress:
      Number(row.valor_alvo) > 0
        ? Math.round(((Number(row.valor_atual) || 0) / Number(row.valor_alvo)) * 100)
        : 0,
  }));
}

function mapPendingBillsRows(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    description: row.descricao,
    value: Number(row.valor) || 0,
    dueDate: row.data_transacao,
    status: row.status,
  }));
}

function mapCardsRows(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    name: row.nome,
    closingDay: Number(row.dia_fechamento) || 1,
    dueDay: Number(row.dia_vencimento) || 10,
    totalLimit: Number(row.limite_total) || 0,
    availableLimit: Number(row.limite_disponivel) || 0,
    usedLimit: Math.max(
      (Number(row.limite_total) || 0) - (Number(row.limite_disponivel) || 0),
      0,
    ),
  }));
}

function mapMonthSnapshotRow(row = {}) {
  return {
    income: Number(row.income) || 0,
    expenses: Number(row.expenses) || 0,
    investedExpenses: 0,
    goals: mapGoalsRows(row.goals || []),
    pendingBills: mapPendingBillsRows(row.pending_bills || []),
    cards: mapCardsRows(row.cards || []),
    portfolio: Number(row.portfolio) || 0,
    investedCapital: Number(row.invested) || 0,
  };
}

/**
 * Snapshot do mes em 1 round-trip.
 * Filtro temporal por intervalo [month_start, next_month) — sem date_trunc(coluna).
 */
async function getMonthSnapshot(userId, referenceMonth = monthStart()) {
  const { monthStart: start, nextMonth } = monthBounds(referenceMonth);

  const { rows } = await pool.query(
    `
      WITH bounds AS (
        SELECT $2::date AS month_start, $3::date AS next_month
      ),
      month_totals AS (
        SELECT
          COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'receita'), 0)::numeric AS income,
          COALESCE(SUM(m.valor) FILTER (
            WHERE m.tipo IN ('despesa', 'recorrencia', 'compra_parcelada', 'pagamento_fatura')
          ), 0)::numeric AS expenses
        FROM movimentacoes m
        CROSS JOIN bounds b
        WHERE m.usuario_id = $1
          AND m.status <> 'cancelada'
          AND m.data_transacao >= b.month_start
          AND m.data_transacao < b.next_month
      ),
      goals_data AS (
        SELECT COALESCE(
          (
            SELECT jsonb_agg(to_jsonb(g) ORDER BY g.prazo ASC NULLS LAST)
            FROM (
              SELECT id, nome, valor_alvo, valor_atual, prazo, status
              FROM metas
              WHERE usuario_id = $1 AND status = 'ativa'
              ORDER BY prazo ASC NULLS LAST
              LIMIT 20
            ) g
          ),
          '[]'::jsonb
        ) AS goals
      ),
      pending_data AS (
        SELECT COALESCE(
          (
            SELECT jsonb_agg(to_jsonb(p) ORDER BY p.data_transacao ASC)
            FROM (
              SELECT id, descricao, valor, data_transacao, status
              FROM movimentacoes
              WHERE usuario_id = $1
                AND tipo IN ('despesa', 'recorrencia', 'pagamento_fatura')
                AND status = 'pendente'
              ORDER BY data_transacao ASC
              LIMIT 10
            ) p
          ),
          '[]'::jsonb
        ) AS pending_bills
      ),
      cards_data AS (
        SELECT COALESCE(
          (
            SELECT jsonb_agg(to_jsonb(c))
            FROM (
              SELECT
                id, nome, dia_fechamento, dia_vencimento,
                limite_total, limite_disponivel
              FROM cartoes
              WHERE usuario_id = $1
            ) c
          ),
          '[]'::jsonb
        ) AS cards
      ),
      investment_totals AS (
        SELECT
          COALESCE(SUM(valor_atual), 0)::numeric AS portfolio,
          COALESCE(SUM(valor_inicial), 0)::numeric AS invested
        FROM investimentos
        WHERE usuario_id = $1
      )
      SELECT
        mt.income,
        mt.expenses,
        gd.goals,
        pd.pending_bills,
        cd.cards,
        it.portfolio,
        it.invested
      FROM month_totals mt
      CROSS JOIN goals_data gd
      CROSS JOIN pending_data pd
      CROSS JOIN cards_data cd
      CROSS JOIN investment_totals it
    `,
    [userId, start, nextMonth],
  );

  return mapMonthSnapshotRow(rows[0]);
}

module.exports = {
  findProfile,
  upsertProfile,
  replaceBudgetRules,
  listBudgetRules,
  updateBudgetUsage,
  upsertHealthScore,
  listHealthHistory,
  getSpendingByCategory,
  getMonthSnapshot,
  monthBounds,
  mapMonthSnapshotRow,
};
