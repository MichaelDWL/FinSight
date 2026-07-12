const pool = require("../../database/pool");

const SETTLED = "('confirmada', 'paga')";
const EXPENSE_TYPES = "('despesa', 'recorrencia', 'compra_parcelada')";
const EXPENSE_STATUS = "('confirmada', 'paga', 'pendente')";

async function getFinancialSummary(userId) {
  const { rows } = await pool.query(
    `
      SELECT
        COALESCE((SELECT SUM(saldo_atual) FROM contas WHERE usuario_id = $1 AND status = 'ativa'), 0) AS balance,
        COALESCE((
          SELECT SUM(valor) FROM movimentacoes
          WHERE usuario_id = $1 AND tipo = 'receita' AND status IN ${SETTLED}
            AND date_trunc('month', data_transacao) = date_trunc('month', CURRENT_DATE)
        ), 0) AS income,
        COALESCE((
          SELECT SUM(valor) FROM movimentacoes
          WHERE usuario_id = $1 AND tipo IN ${EXPENSE_TYPES} AND status IN ${EXPENSE_STATUS}
            AND date_trunc('month', data_transacao) = date_trunc('month', CURRENT_DATE)
        ), 0) AS expenses,
        COALESCE((SELECT SUM(valor_atual) FROM investimentos WHERE usuario_id = $1), 0) AS investments,
        COALESCE((
          SELECT SUM(valor) FROM movimentacoes
          WHERE usuario_id = $1 AND tipo IN ('despesa', 'recorrencia', 'pagamento_fatura') AND status = 'pendente'
        ), 0) AS pending_bills
    `,
    [userId],
  );

  const summary = rows[0];
  const balance = Number(summary.balance);
  const investments = Number(summary.investments);

  return {
    balance,
    income: Number(summary.income),
    expenses: Number(summary.expenses),
    netWorth: balance + investments,
    pendingBills: Number(summary.pending_bills),
    investmentsTotal: investments,
  };
}

async function getPreviousMonthSummary(userId) {
  const { rows } = await pool.query(
    `
      SELECT
        COALESCE((
          SELECT SUM(valor) FROM movimentacoes
          WHERE usuario_id = $1 AND tipo = 'receita' AND status IN ${SETTLED}
            AND date_trunc('month', data_transacao) = date_trunc('month', CURRENT_DATE - interval '1 month')
        ), 0) AS income,
        COALESCE((
          SELECT SUM(valor) FROM movimentacoes
          WHERE usuario_id = $1 AND tipo IN ${EXPENSE_TYPES} AND status IN ${EXPENSE_STATUS}
            AND date_trunc('month', data_transacao) = date_trunc('month', CURRENT_DATE - interval '1 month')
        ), 0) AS expenses
    `,
    [userId],
  );

  return {
    income: Number(rows[0].income),
    expenses: Number(rows[0].expenses),
  };
}

async function getMonthlyFlow(userId, months = 6) {
  const { rows } = await pool.query(
    `
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE) - (($2::int - 1) * interval '1 month'),
          date_trunc('month', CURRENT_DATE),
          interval '1 month'
        )::date AS month_start
      )
      SELECT
        m.month_start,
        to_char(m.month_start, 'Mon') AS month_label,
        COALESCE(SUM(CASE
          WHEN mov.tipo = 'receita' AND mov.status IN ${SETTLED} THEN mov.valor
        END), 0) AS income,
        COALESCE(SUM(CASE
          WHEN mov.tipo IN ${EXPENSE_TYPES} AND mov.status IN ${EXPENSE_STATUS} THEN mov.valor
        END), 0) AS expenses
      FROM months m
      LEFT JOIN movimentacoes mov
        ON mov.usuario_id = $1
        AND date_trunc('month', mov.data_transacao) = m.month_start
      GROUP BY m.month_start
      ORDER BY m.month_start ASC
    `,
    [userId, months],
  );

  return rows.map((row) => {
    const income = Number(row.income);
    const expenses = Number(row.expenses);

    return {
      month: row.month_label,
      income,
      expenses,
      balance: income - expenses,
    };
  });
}

async function getCategorySpendingComparison(userId) {
  const { rows } = await pool.query(
    `
      SELECT
        COALESCE(c.nome, 'Outros') AS category,
        COALESCE(SUM(CASE
          WHEN date_trunc('month', m.data_transacao) = date_trunc('month', CURRENT_DATE) THEN m.valor
        END), 0) AS current_month,
        COALESCE(SUM(CASE
          WHEN date_trunc('month', m.data_transacao) = date_trunc('month', CURRENT_DATE - interval '1 month') THEN m.valor
        END), 0) AS previous_month
      FROM movimentacoes m
      LEFT JOIN categorias c ON c.id = m.categoria_id
      WHERE m.usuario_id = $1
        AND m.tipo IN ${EXPENSE_TYPES}
        AND m.status IN ${EXPENSE_STATUS}
        AND m.data_transacao >= date_trunc('month', CURRENT_DATE - interval '1 month')
      GROUP BY COALESCE(c.nome, 'Outros')
      HAVING COALESCE(SUM(CASE
        WHEN date_trunc('month', m.data_transacao) = date_trunc('month', CURRENT_DATE) THEN m.valor
      END), 0) > 0
        OR COALESCE(SUM(CASE
          WHEN date_trunc('month', m.data_transacao) = date_trunc('month', CURRENT_DATE - interval '1 month') THEN m.valor
        END), 0) > 0
    `,
    [userId],
  );

  return rows.map((row) => ({
    category: row.category,
    currentMonth: Number(row.current_month),
    previousMonth: Number(row.previous_month),
  }));
}

async function getTopIncomeThisMonth(userId) {
  const { rows } = await pool.query(
    `
      SELECT
        m.descricao AS description,
        m.valor AS value,
        COALESCE(c.nome, m.tipo::text) AS category
      FROM movimentacoes m
      LEFT JOIN categorias c ON c.id = m.categoria_id
      WHERE m.usuario_id = $1
        AND m.tipo = 'receita'
        AND m.status IN ${SETTLED}
        AND date_trunc('month', m.data_transacao) = date_trunc('month', CURRENT_DATE)
      ORDER BY m.valor DESC
      LIMIT 1
    `,
    [userId],
  );

  if (!rows[0]) return null;

  return {
    description: rows[0].description,
    value: Number(rows[0].value),
    category: rows[0].category,
  };
}

async function getCurrentMonthInvoices(userId) {
  const { rows } = await pool.query(
    `
      SELECT
        c.id AS card_id,
        c.nome AS card_name,
        c.bandeira AS card_brand,
        c.cor AS card_color,
        c.ultimos_digitos AS last_digits,
        c.dia_vencimento AS due_day,
        f.id AS invoice_id,
        f.mes_referencia AS reference_month,
        f.data_vencimento AS due_date,
        f.valor_total AS total,
        f.valor_pago AS paid,
        f.status
      FROM cartoes c
      LEFT JOIN faturas f
        ON f.cartao_id = c.id
        AND f.mes_referencia = date_trunc('month', CURRENT_DATE)::date
      WHERE c.usuario_id = $1
      ORDER BY c.created_at ASC
    `,
    [userId],
  );

  return rows.map((row) => ({
    cardId: row.card_id,
    cardName: row.card_name,
    cardBrand: row.card_brand,
    cardColor: row.card_color || "#0d6efd",
    lastDigits: row.last_digits,
    dueDay: Number(row.due_day),
    invoice: row.invoice_id
      ? {
          id: row.invoice_id,
          referenceMonth: row.reference_month,
          dueDate: row.due_date,
          total: Number(row.total),
          paid: Number(row.paid),
          status: row.status,
        }
      : null,
  }));
}

module.exports = {
  getFinancialSummary,
  getPreviousMonthSummary,
  getMonthlyFlow,
  getCategorySpendingComparison,
  getTopIncomeThisMonth,
  getCurrentMonthInvoices,
};
