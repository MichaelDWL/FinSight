const { BOUNDS_CTE, EVOLUTION_BOUNDS_CTE } = require("./movements.base");

function buildExpensesQuery() {
  return `
    WITH
      ${BOUNDS_CTE},
      ${EVOLUTION_BOUNDS_CTE},
      period_totals AS (
        SELECT
          COALESCE(SUM(CASE
            WHEN v.is_despesa_periodo AND v.data_transacao BETWEEN b.start_date AND b.end_date
            THEN v.valor
          END), 0) AS total,
          COALESCE(SUM(CASE
            WHEN v.is_despesa_periodo AND v.data_transacao BETWEEN b.prev_start AND b.prev_end
            THEN v.valor
          END), 0) AS previous_total,
          COUNT(CASE
            WHEN v.is_despesa_periodo AND v.data_transacao BETWEEN b.start_date AND b.end_date
            THEN 1
          END) AS transactions_count
        FROM bounds b
        LEFT JOIN vw_analytics_movimentacoes v ON v.usuario_id = $1
      ),
      by_category AS (
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
      by_day AS (
        SELECT
          d.day_date,
          to_char(d.day_date, 'DD/MM') AS day_label,
          COALESCE(SUM(v.valor), 0) AS total
        FROM (
          SELECT generate_series(
            (SELECT start_date FROM bounds),
            (SELECT end_date FROM bounds),
            interval '1 day'
          )::date AS day_date
        ) d
        LEFT JOIN vw_analytics_movimentacoes v
          ON v.usuario_id = $1
          AND v.is_despesa_periodo
          AND v.data_transacao = d.day_date
        GROUP BY d.day_date
        ORDER BY d.day_date
      ),
      by_month AS (
        SELECT
          m.month_start,
          to_char(m.month_start, 'TMMon') AS month_label,
          COALESCE(SUM(v.valor), 0) AS total
        FROM (
          SELECT generate_series(
            (SELECT start_date FROM evolution_bounds),
            date_trunc('month', (SELECT end_date FROM evolution_bounds)::timestamp)::date,
            interval '1 month'
          )::date AS month_start
        ) m
        LEFT JOIN vw_analytics_movimentacoes v
          ON v.usuario_id = $1
          AND v.is_despesa_periodo
          AND date_trunc('month', v.data_transacao)::date = m.month_start
        GROUP BY m.month_start
        ORDER BY m.month_start
      ),
      category_comparison AS (
        SELECT
          v.categoria_nome AS category,
          v.categoria_cor AS color,
          COALESCE(SUM(CASE
            WHEN v.data_transacao BETWEEN b.start_date AND b.end_date THEN v.valor
          END), 0) AS current_period,
          COALESCE(SUM(CASE
            WHEN v.data_transacao BETWEEN b.prev_start AND b.prev_end THEN v.valor
          END), 0) AS previous_period
        FROM vw_analytics_movimentacoes v, bounds b
        WHERE v.usuario_id = $1
          AND v.is_despesa_periodo
          AND v.data_transacao BETWEEN b.prev_start AND b.end_date
        GROUP BY v.categoria_nome, v.categoria_cor
      ),
      top_expenses AS (
        SELECT
          v.id,
          v.descricao AS description,
          v.categoria_nome AS category,
          v.categoria_cor AS color,
          v.categoria_icone AS icon,
          v.valor AS value,
          v.data_transacao AS date,
          COALESCE(ct.nome, 'Sem conta') AS account
        FROM vw_analytics_movimentacoes v
        LEFT JOIN contas ct ON ct.id = v.conta_id, bounds b
        WHERE v.usuario_id = $1
          AND v.is_despesa_periodo
          AND v.data_transacao BETWEEN b.start_date AND b.end_date
        ORDER BY v.valor DESC, v.data_transacao DESC
        LIMIT 10
      )
    SELECT json_build_object(
      'periodTotals', (SELECT row_to_json(p) FROM period_totals p),
      'byCategory', COALESCE((
        SELECT json_agg(
          json_build_object('category', category, 'color', color, 'value', total)
          ORDER BY total DESC
        ) FROM by_category
      ), '[]'::json),
      'byDay', COALESCE((
        SELECT json_agg(
          json_build_object('date', day_date, 'label', day_label, 'value', total)
          ORDER BY day_date
        ) FROM by_day
      ), '[]'::json),
      'byMonth', COALESCE((
        SELECT json_agg(
          json_build_object('month', month_label, 'monthStart', month_start, 'value', total)
          ORDER BY month_start
        ) FROM by_month
      ), '[]'::json),
      'categoryComparison', COALESCE((
        SELECT json_agg(
          json_build_object(
            'category', category,
            'color', color,
            'currentPeriod', current_period,
            'previousPeriod', previous_period
          )
        ) FROM category_comparison
      ), '[]'::json),
      'topExpenses', COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', id,
            'description', description,
            'category', category,
            'color', color,
            'icon', icon,
            'value', value,
            'date', date,
            'account', account
          )
        ) FROM top_expenses
      ), '[]'::json)
    ) AS payload
  `;
}

module.exports = { buildExpensesQuery };
