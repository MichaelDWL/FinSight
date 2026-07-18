const { MONTHLY_FLOW_MONTHS } = require("../constants");

const BOUNDS_CTE = `
  bounds AS (
    SELECT
      $2::date AS start_date,
      $3::date AS end_date,
      $4::date AS prev_start,
      $5::date AS prev_end
  )
`;

const FLOW_BOUNDS_CTE = `
  flow_bounds AS (
    SELECT
      (date_trunc('month', (SELECT end_date FROM bounds)::timestamp) - (($6::int - 1) * interval '1 month'))::date AS start_date,
      (SELECT end_date FROM bounds) AS end_date
  )
`;

function buildGeneralQuery() {
  return `
    WITH
      ${BOUNDS_CTE},
      ${FLOW_BOUNDS_CTE},
      patrimonio AS (
        SELECT
          (
            SELECT COALESCE(SUM(saldo_atual), 0)
            FROM contas
            WHERE usuario_id = $1 AND status = 'ativa'
          ) AS balance,
          (
            SELECT COALESCE(SUM(valor_atual), 0)
            FROM investimentos
            WHERE usuario_id = $1
          ) AS investments
      ),
      period_summary AS (
        SELECT
          COALESCE(SUM(CASE WHEN v.is_receita_liquidada AND v.data_transacao BETWEEN b.start_date AND b.end_date THEN v.valor END), 0) AS income,
          COALESCE(SUM(CASE WHEN v.is_despesa_periodo AND v.data_transacao BETWEEN b.start_date AND b.end_date THEN v.valor END), 0) AS expenses
        FROM bounds b
        LEFT JOIN vw_analytics_movimentacoes v ON v.usuario_id = $1
      ),
      previous_summary AS (
        SELECT
          COALESCE(SUM(CASE WHEN v.is_receita_liquidada AND v.data_transacao BETWEEN b.prev_start AND b.prev_end THEN v.valor END), 0) AS income,
          COALESCE(SUM(CASE WHEN v.is_despesa_periodo AND v.data_transacao BETWEEN b.prev_start AND b.prev_end THEN v.valor END), 0) AS expenses
        FROM bounds b
        LEFT JOIN vw_analytics_movimentacoes v ON v.usuario_id = $1
      ),
      monthly_flow AS (
        SELECT
          m.month_start,
          to_char(m.month_start, 'TMMon') AS month_label,
          COALESCE(SUM(CASE WHEN v.is_receita_liquidada THEN v.valor END), 0) AS income,
          COALESCE(SUM(CASE WHEN v.is_despesa_periodo THEN v.valor END), 0) AS expenses
        FROM (
          SELECT generate_series(
            (SELECT start_date FROM flow_bounds),
            date_trunc('month', (SELECT end_date FROM flow_bounds)::timestamp)::date,
            interval '1 month'
          )::date AS month_start
        ) m
        LEFT JOIN vw_analytics_movimentacoes v
          ON v.usuario_id = $1
          AND date_trunc('month', v.data_transacao)::date = m.month_start
        GROUP BY m.month_start
        ORDER BY m.month_start
      ),
      category_distribution AS (
        SELECT
          v.categoria_nome AS category,
          v.categoria_cor AS color,
          COALESCE(SUM(v.valor), 0) AS total
        FROM vw_analytics_movimentacoes v, bounds b
        WHERE v.usuario_id = $1
          AND v.is_despesa_periodo
          AND v.data_transacao BETWEEN b.start_date AND b.end_date
        GROUP BY v.categoria_nome, v.categoria_cor
        HAVING COALESCE(SUM(v.valor), 0) > 0
        ORDER BY total DESC
      ),
      category_comparison AS (
        SELECT
          v.categoria_nome AS category,
          COALESCE(SUM(CASE WHEN v.data_transacao BETWEEN b.start_date AND b.end_date THEN v.valor END), 0) AS current_month,
          COALESCE(SUM(CASE WHEN v.data_transacao BETWEEN b.prev_start AND b.prev_end THEN v.valor END), 0) AS previous_month
        FROM vw_analytics_movimentacoes v, bounds b
        WHERE v.usuario_id = $1
          AND v.is_despesa_periodo
          AND v.data_transacao BETWEEN b.prev_start AND b.end_date
        GROUP BY v.categoria_nome
      ),
      upcoming_bills AS (
        SELECT
          v.id,
          v.descricao AS name,
          v.categoria_nome AS category,
          v.categoria_icone AS icon,
          v.valor AS value,
          v.data_transacao AS due_date,
          v.status
        FROM vw_analytics_movimentacoes v
        WHERE v.usuario_id = $1
          AND v.tipo IN ('despesa', 'recorrencia')
          AND v.status = 'pendente'
        ORDER BY v.data_transacao ASC, v.created_at DESC
        LIMIT 5
      ),
      recent_movements AS (
        SELECT
          v.id,
          v.descricao AS description,
          v.categoria_nome AS category,
          v.categoria_icone AS icon,
          v.tipo,
          v.valor AS value,
          v.data_transacao AS date,
          v.status,
          v.forma_pagamento AS payment,
          COALESCE(ct.nome, 'Sem conta') AS account
        FROM vw_analytics_movimentacoes v
        LEFT JOIN contas ct ON ct.id = v.conta_id
        WHERE v.usuario_id = $1
          AND v.liquidado
          AND (v.is_receita OR v.is_despesa)
        ORDER BY v.data_transacao DESC, v.created_at DESC
        LIMIT 10
      ),
      pending_bills_total AS (
        SELECT COALESCE(SUM(v.valor), 0) AS total
        FROM vw_analytics_movimentacoes v
        WHERE v.usuario_id = $1
          AND v.tipo IN ('despesa', 'recorrencia')
          AND v.status = 'pendente'
      ),
      cards_summary AS (
        SELECT
          c.id,
          c.nome AS name,
          c.limite_total AS total_limit,
          GREATEST(c.limite_total - c.limite_disponivel, 0) AS used_limit,
          c.limite_disponivel AS available_limit,
          c.dia_vencimento AS due_day,
          c.dia_fechamento AS closing_day,
          f.valor_total AS invoice_total,
          f.data_vencimento AS invoice_due_date
        FROM cartoes c
        LEFT JOIN faturas f
          ON f.cartao_id = c.id
          AND f.mes_referencia = date_trunc('month', CURRENT_DATE)::date
        WHERE c.usuario_id = $1
        ORDER BY c.created_at ASC
      )
    SELECT json_build_object(
      'patrimonio', (SELECT row_to_json(p) FROM patrimonio p),
      'periodSummary', (SELECT row_to_json(p) FROM period_summary p),
      'previousSummary', (SELECT row_to_json(p) FROM previous_summary p),
      'monthlyFlow', COALESCE((
        SELECT json_agg(
          json_build_object(
            'month', month_label,
            'monthStart', month_start,
            'income', income,
            'expenses', expenses,
            'balance', income - expenses
          )
          ORDER BY month_start
        )
        FROM monthly_flow
      ), '[]'::json),
      'categoryDistribution', COALESCE((
        SELECT json_agg(
          json_build_object(
            'category', category,
            'color', color,
            'value', total
          )
          ORDER BY total DESC
        )
        FROM category_distribution
      ), '[]'::json),
      'categoryComparison', COALESCE((
        SELECT json_agg(
          json_build_object(
            'category', category,
            'currentMonth', current_month,
            'previousMonth', previous_month
          )
        )
        FROM category_comparison
      ), '[]'::json),
      'upcomingBills', COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', id,
            'name', name,
            'category', category,
            'icon', icon,
            'value', value,
            'dueDate', due_date,
            'status', status
          )
        )
        FROM upcoming_bills
      ), '[]'::json),
      'recentMovements', COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', id,
            'description', description,
            'category', category,
            'icon', icon,
            'type', CASE WHEN tipo = 'receita' THEN 'Receita' ELSE 'Despesa' END,
            'value', CASE WHEN tipo = 'receita' THEN value ELSE -value END,
            'date', date,
            'status', status,
            'payment', payment,
            'account', account
          )
        )
        FROM recent_movements
      ), '[]'::json),
      'pendingBillsTotal', (SELECT total FROM pending_bills_total),
      'cards', COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', id,
            'name', name,
            'totalLimit', total_limit,
            'usedLimit', used_limit,
            'availableLimit', available_limit,
            'dueDay', due_day,
            'closingDay', closing_day,
            'invoiceTotal', invoice_total,
            'invoiceDueDate', invoice_due_date
          )
        )
        FROM cards_summary
      ), '[]'::json)
    ) AS payload
  `;
}

module.exports = { buildGeneralQuery, MONTHLY_FLOW_MONTHS };
