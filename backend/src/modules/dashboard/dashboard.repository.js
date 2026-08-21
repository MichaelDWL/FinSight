const pool = require("../../database/pool");

const SETTLED = "('confirmada', 'paga')";
const EXPENSE_TYPES = "('despesa', 'recorrencia', 'compra_parcelada')";
const EXPENSE_STATUS = "('confirmada', 'paga', 'pendente')";

const MONTH_BOUNDS_CTE = `
  bounds AS (
    SELECT
      date_trunc('month', CURRENT_DATE)::date AS current_month,
      (date_trunc('month', CURRENT_DATE) - interval '1 month')::date AS previous_month,
      (date_trunc('month', CURRENT_DATE) + interval '1 month')::date AS next_month
  )
`;

function mapFinancialSummaryRow(row) {
  const balance = Number(row.balance);
  const investments = Number(row.investments);

  return {
    summary: {
      balance,
      income: Number(row.income),
      expenses: Number(row.expenses),
      netWorth: balance + investments,
      pendingBills: Number(row.pending_bills),
      investmentsTotal: investments,
    },
    previousMonth: {
      income: Number(row.previous_income),
      expenses: Number(row.previous_expenses),
    },
  };
}

async function getFinancialSummaries(userId) {
  const { rows } = await pool.query(
    `
      WITH ${MONTH_BOUNDS_CTE},
      mov_totals AS (
        SELECT
          COALESCE(SUM(
            CASE
              WHEN m.tipo = 'receita'
                AND m.status IN ${SETTLED}
                AND m.data_transacao >= b.current_month
                AND m.data_transacao < b.next_month
              THEN m.valor
            END
          ), 0) AS income,
          COALESCE(SUM(
            CASE
              WHEN m.tipo IN ${EXPENSE_TYPES}
                AND m.status IN ${EXPENSE_STATUS}
                AND m.data_transacao >= b.current_month
                AND m.data_transacao < b.next_month
              THEN m.valor
            END
          ), 0) AS expenses,
          COALESCE(SUM(
            CASE
              WHEN m.tipo = 'receita'
                AND m.status IN ${SETTLED}
                AND m.data_transacao >= b.previous_month
                AND m.data_transacao < b.current_month
              THEN m.valor
            END
          ), 0) AS previous_income,
          COALESCE(SUM(
            CASE
              WHEN m.tipo IN ${EXPENSE_TYPES}
                AND m.status IN ${EXPENSE_STATUS}
                AND m.data_transacao >= b.previous_month
                AND m.data_transacao < b.current_month
              THEN m.valor
            END
          ), 0) AS previous_expenses,
          COALESCE(SUM(
            CASE
              WHEN m.tipo IN ('despesa', 'recorrencia', 'pagamento_fatura')
                AND m.status = 'pendente'
              THEN m.valor
            END
          ), 0) AS pending_bills
        FROM movimentacoes m
        CROSS JOIN bounds b
        WHERE m.usuario_id = $1
      ),
      account_totals AS (
        SELECT COALESCE(SUM(saldo_atual), 0) AS balance
        FROM contas
        WHERE usuario_id = $1 AND status = 'ativa'
      ),
      investment_totals AS (
        SELECT COALESCE(SUM(valor_atual), 0) AS investments
        FROM investimentos
        WHERE usuario_id = $1
      )
      SELECT
        a.balance,
        i.investments,
        m.income,
        m.expenses,
        m.previous_income,
        m.previous_expenses,
        m.pending_bills
      FROM mov_totals m
      CROSS JOIN account_totals a
      CROSS JOIN investment_totals i
    `,
    [userId],
  );

  return mapFinancialSummaryRow(rows[0]);
}

async function getFinancialSummary(userId) {
  const { summary } = await getFinancialSummaries(userId);
  return summary;
}

async function getPreviousMonthSummary(userId) {
  const { previousMonth } = await getFinancialSummaries(userId);
  return previousMonth;
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
      ),
      month_ends AS (
        SELECT
          month_start,
          (month_start + interval '1 month')::date AS month_end
        FROM months
      )
      SELECT
        me.month_start,
        to_char(me.month_start, 'Mon') AS month_label,
        COALESCE(SUM(CASE
          WHEN mov.tipo = 'receita' AND mov.status IN ${SETTLED} THEN mov.valor
        END), 0) AS income,
        COALESCE(SUM(CASE
          WHEN mov.tipo IN ${EXPENSE_TYPES} AND mov.status IN ${EXPENSE_STATUS} THEN mov.valor
        END), 0) AS expenses
      FROM month_ends me
      LEFT JOIN movimentacoes mov
        ON mov.usuario_id = $1
        AND mov.data_transacao >= me.month_start
        AND mov.data_transacao < me.month_end
      GROUP BY me.month_start
      ORDER BY me.month_start ASC
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
      WITH ${MONTH_BOUNDS_CTE}
      SELECT
        COALESCE(c.nome, 'Outros') AS category,
        COALESCE(SUM(
          CASE
            WHEN m.data_transacao >= b.current_month AND m.data_transacao < b.next_month
            THEN m.valor
          END
        ), 0) AS current_month,
        COALESCE(SUM(
          CASE
            WHEN m.data_transacao >= b.previous_month AND m.data_transacao < b.current_month
            THEN m.valor
          END
        ), 0) AS previous_month
      FROM movimentacoes m
      CROSS JOIN bounds b
      LEFT JOIN categorias c ON c.id = m.categoria_id
      WHERE m.usuario_id = $1
        AND m.tipo IN ${EXPENSE_TYPES}
        AND m.status IN ${EXPENSE_STATUS}
        AND m.data_transacao >= b.previous_month
        AND m.data_transacao < b.next_month
      GROUP BY COALESCE(c.nome, 'Outros')
      HAVING COALESCE(SUM(
          CASE
            WHEN m.data_transacao >= b.current_month AND m.data_transacao < b.next_month
            THEN m.valor
          END
        ), 0) > 0
        OR COALESCE(SUM(
          CASE
            WHEN m.data_transacao >= b.previous_month AND m.data_transacao < b.current_month
            THEN m.valor
          END
        ), 0) > 0
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
      WITH bounds AS (
        SELECT
          date_trunc('month', CURRENT_DATE)::date AS current_month,
          (date_trunc('month', CURRENT_DATE) + interval '1 month')::date AS next_month
      )
      SELECT
        m.descricao AS description,
        m.valor AS value,
        COALESCE(c.nome, m.tipo::text) AS category
      FROM movimentacoes m
      CROSS JOIN bounds b
      LEFT JOIN categorias c ON c.id = m.categoria_id
      WHERE m.usuario_id = $1
        AND m.tipo = 'receita'
        AND m.status IN ${SETTLED}
        AND m.data_transacao >= b.current_month
        AND m.data_transacao < b.next_month
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
      WITH bounds AS (
        SELECT date_trunc('month', CURRENT_DATE)::date AS current_month
      )
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
      CROSS JOIN bounds b
      LEFT JOIN faturas f
        ON f.cartao_id = c.id
        AND f.mes_referencia = b.current_month
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

/**
 * Bundle da Home secondary: 1 round-trip no lugar de
 * getFinancialSummaries + getCategorySpendingComparison + getTopIncomeThisMonth.
 * Mantem semantica equivalente via CTEs.
 */
async function getHomeSecondaryBundle(userId) {
  const { rows } = await pool.query(
    `
      WITH ${MONTH_BOUNDS_CTE},
      mov_totals AS (
        SELECT
          COALESCE(SUM(
            CASE
              WHEN m.tipo = 'receita'
                AND m.status IN ${SETTLED}
                AND m.data_transacao >= b.current_month
                AND m.data_transacao < b.next_month
              THEN m.valor
            END
          ), 0) AS income,
          COALESCE(SUM(
            CASE
              WHEN m.tipo IN ${EXPENSE_TYPES}
                AND m.status IN ${EXPENSE_STATUS}
                AND m.data_transacao >= b.current_month
                AND m.data_transacao < b.next_month
              THEN m.valor
            END
          ), 0) AS expenses,
          COALESCE(SUM(
            CASE
              WHEN m.tipo = 'receita'
                AND m.status IN ${SETTLED}
                AND m.data_transacao >= b.previous_month
                AND m.data_transacao < b.current_month
              THEN m.valor
            END
          ), 0) AS previous_income,
          COALESCE(SUM(
            CASE
              WHEN m.tipo IN ${EXPENSE_TYPES}
                AND m.status IN ${EXPENSE_STATUS}
                AND m.data_transacao >= b.previous_month
                AND m.data_transacao < b.current_month
              THEN m.valor
            END
          ), 0) AS previous_expenses,
          COALESCE(SUM(
            CASE
              WHEN m.tipo IN ('despesa', 'recorrencia', 'pagamento_fatura')
                AND m.status = 'pendente'
              THEN m.valor
            END
          ), 0) AS pending_bills
        FROM movimentacoes m
        CROSS JOIN bounds b
        WHERE m.usuario_id = $1
      ),
      account_totals AS (
        SELECT COALESCE(SUM(saldo_atual), 0) AS balance
        FROM contas
        WHERE usuario_id = $1 AND status = 'ativa'
      ),
      investment_totals AS (
        SELECT COALESCE(SUM(valor_atual), 0) AS investments
        FROM investimentos
        WHERE usuario_id = $1
      ),
      categories AS (
        SELECT
          COALESCE(c.nome, 'Outros') AS category,
          COALESCE(SUM(
            CASE
              WHEN m.data_transacao >= b.current_month AND m.data_transacao < b.next_month
              THEN m.valor
            END
          ), 0) AS current_month,
          COALESCE(SUM(
            CASE
              WHEN m.data_transacao >= b.previous_month AND m.data_transacao < b.current_month
              THEN m.valor
            END
          ), 0) AS previous_month
        FROM movimentacoes m
        CROSS JOIN bounds b
        LEFT JOIN categorias c ON c.id = m.categoria_id
        WHERE m.usuario_id = $1
          AND m.tipo IN ${EXPENSE_TYPES}
          AND m.status IN ${EXPENSE_STATUS}
          AND m.data_transacao >= b.previous_month
          AND m.data_transacao < b.next_month
        GROUP BY COALESCE(c.nome, 'Outros')
        HAVING COALESCE(SUM(
            CASE
              WHEN m.data_transacao >= b.current_month AND m.data_transacao < b.next_month
              THEN m.valor
            END
          ), 0) > 0
          OR COALESCE(SUM(
            CASE
              WHEN m.data_transacao >= b.previous_month AND m.data_transacao < b.current_month
              THEN m.valor
            END
          ), 0) > 0
      ),
      top_income AS (
        SELECT
          m.descricao AS description,
          m.valor AS value,
          COALESCE(c.nome, m.tipo::text) AS category
        FROM movimentacoes m
        CROSS JOIN bounds b
        LEFT JOIN categorias c ON c.id = m.categoria_id
        WHERE m.usuario_id = $1
          AND m.tipo = 'receita'
          AND m.status IN ${SETTLED}
          AND m.data_transacao >= b.current_month
          AND m.data_transacao < b.next_month
        ORDER BY m.valor DESC
        LIMIT 1
      )
      SELECT
        a.balance,
        i.investments,
        m.income,
        m.expenses,
        m.previous_income,
        m.previous_expenses,
        m.pending_bills,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'category', category,
            'current_month', current_month,
            'previous_month', previous_month
          ) ORDER BY current_month DESC)
          FROM categories),
          '[]'::json
        ) AS categories,
        (SELECT json_build_object(
          'description', description,
          'value', value,
          'category', category
        ) FROM top_income) AS top_income
      FROM mov_totals m
      CROSS JOIN account_totals a
      CROSS JOIN investment_totals i
    `,
    [userId],
  );

  const row = rows[0] || {};
  const financial = mapFinancialSummaryRow({
    balance: row.balance,
    investments: row.investments,
    income: row.income,
    expenses: row.expenses,
    previous_income: row.previous_income,
    previous_expenses: row.previous_expenses,
    pending_bills: row.pending_bills,
  });

  const categoriesRaw = Array.isArray(row.categories)
    ? row.categories
    : typeof row.categories === "string"
      ? JSON.parse(row.categories)
      : [];

  const categoryComparison = categoriesRaw.map((item) => ({
    category: item.category,
    currentMonth: Number(item.current_month),
    previousMonth: Number(item.previous_month),
  }));

  let topIncome = null;
  const top = row.top_income;
  if (top && (top.description || top.value != null)) {
    topIncome = {
      description: top.description,
      value: Number(top.value),
      category: top.category,
    };
  }

  return { financial, categoryComparison, topIncome };
}

module.exports = {
  getFinancialSummaries,
  getFinancialSummary,
  getPreviousMonthSummary,
  getMonthlyFlow,
  getCategorySpendingComparison,
  getTopIncomeThisMonth,
  getCurrentMonthInvoices,
  getHomeSecondaryBundle,
};
