const { BOUNDS_CTE, EVOLUTION_BOUNDS_CTE } = require("./movements.base");

function buildCashflowQuery() {
  return `
    WITH
      ${BOUNDS_CTE},
      ${EVOLUTION_BOUNDS_CTE},
      current_balance AS (
        SELECT COALESCE(SUM(saldo_atual), 0) AS balance
        FROM contas
        WHERE usuario_id = $1 AND status = 'ativa'
      ),
      period_totals AS (
        SELECT
          COALESCE(SUM(CASE
            WHEN v.is_receita_liquidada AND v.data_transacao BETWEEN b.start_date AND b.end_date
            THEN v.valor
          END), 0) AS income,
          COALESCE(SUM(CASE
            WHEN v.is_despesa_periodo AND v.data_transacao BETWEEN b.start_date AND b.end_date
            THEN v.valor
          END), 0) AS expenses
        FROM bounds b
        LEFT JOIN vw_analytics_movimentacoes v ON v.usuario_id = $1
      ),
      daily_flow AS (
        SELECT
          d.day_date,
          to_char(d.day_date, 'DD/MM') AS day_label,
          COALESCE(SUM(CASE WHEN v.is_receita_liquidada THEN v.valor END), 0) AS income,
          COALESCE(SUM(CASE WHEN v.is_despesa_periodo THEN v.valor END), 0) AS expenses
        FROM (
          SELECT generate_series(
            (SELECT start_date FROM bounds),
            (SELECT end_date FROM bounds),
            interval '1 day'
          )::date AS day_date
        ) d
        LEFT JOIN vw_analytics_movimentacoes v
          ON v.usuario_id = $1
          AND v.data_transacao = d.day_date
          AND (v.is_receita_liquidada OR v.is_despesa_periodo)
        GROUP BY d.day_date
        ORDER BY d.day_date
      ),
      daily_with_accumulated AS (
        SELECT
          day_date,
          day_label,
          income,
          expenses,
          income - expenses AS net,
          SUM(income - expenses) OVER (ORDER BY day_date) AS accumulated
        FROM daily_flow
      ),
      weekly_flow AS (
        SELECT
          date_trunc('week', v.data_transacao)::date AS week_start,
          to_char(date_trunc('week', v.data_transacao)::date, 'DD/MM') AS week_label,
          COALESCE(SUM(CASE WHEN v.is_receita_liquidada THEN v.valor END), 0) AS income,
          COALESCE(SUM(CASE WHEN v.is_despesa_periodo THEN v.valor END), 0) AS expenses
        FROM vw_analytics_movimentacoes v, bounds b
        WHERE v.usuario_id = $1
          AND v.data_transacao BETWEEN b.start_date AND b.end_date
          AND (v.is_receita_liquidada OR v.is_despesa_periodo)
        GROUP BY date_trunc('week', v.data_transacao)::date
        ORDER BY week_start
      ),
      monthly_flow AS (
        SELECT
          m.month_start,
          to_char(m.month_start, 'TMMon') AS month_label,
          COALESCE(SUM(CASE WHEN v.is_receita_liquidada THEN v.valor END), 0) AS income,
          COALESCE(SUM(CASE WHEN v.is_despesa_periodo THEN v.valor END), 0) AS expenses
        FROM (
          SELECT generate_series(
            (SELECT start_date FROM evolution_bounds),
            date_trunc('month', (SELECT end_date FROM evolution_bounds)::timestamp)::date,
            interval '1 month'
          )::date AS month_start
        ) m
        LEFT JOIN vw_analytics_movimentacoes v
          ON v.usuario_id = $1
          AND date_trunc('month', v.data_transacao)::date = m.month_start
        GROUP BY m.month_start
        ORDER BY m.month_start
      )
    SELECT json_build_object(
      'currentBalance', (SELECT balance FROM current_balance),
      'periodTotals', (SELECT row_to_json(p) FROM period_totals p),
      'dailyFlow', COALESCE((
        SELECT json_agg(
          json_build_object(
            'date', day_date,
            'label', day_label,
            'income', income,
            'expenses', expenses,
            'net', net,
            'accumulated', accumulated
          )
          ORDER BY day_date
        ) FROM daily_with_accumulated
      ), '[]'::json),
      'weeklyFlow', COALESCE((
        SELECT json_agg(
          json_build_object(
            'weekStart', week_start,
            'label', week_label,
            'income', income,
            'expenses', expenses,
            'net', income - expenses
          )
          ORDER BY week_start
        ) FROM weekly_flow
      ), '[]'::json),
      'monthlyFlow', COALESCE((
        SELECT json_agg(
          json_build_object(
            'month', month_label,
            'monthStart', month_start,
            'income', income,
            'expenses', expenses,
            'net', income - expenses
          )
          ORDER BY month_start
        ) FROM monthly_flow
      ), '[]'::json)
    ) AS payload
  `;
}

module.exports = { buildCashflowQuery };
