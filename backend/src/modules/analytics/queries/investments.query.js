const { BOUNDS_CTE, EVOLUTION_BOUNDS_CTE } = require("./movements.base");

function buildInvestmentsQuery() {
  return `
    WITH
      ${BOUNDS_CTE},
      ${EVOLUTION_BOUNDS_CTE},
      portfolio_current AS (
        SELECT
          COALESCE(SUM(i.valor_atual), 0) AS patrimonio,
          COALESCE(SUM(i.valor_inicial), 0) AS total_aportado,
          COALESCE(SUM(i.valor_atual - i.valor_inicial), 0) AS lucro,
          COUNT(*) AS investments_count
        FROM investimentos i
        WHERE i.usuario_id = $1
      ),
      distribution AS (
        SELECT
          ci.nome AS category,
          ci.cor AS color,
          ci.icone AS icon,
          COALESCE(SUM(i.valor_atual), 0) AS value,
          COUNT(i.id) AS count
        FROM investimentos i
        JOIN categorias_investimentos ci ON ci.id = i.categoria_id
        WHERE i.usuario_id = $1
        GROUP BY ci.nome, ci.cor, ci.icone
        HAVING COALESCE(SUM(i.valor_atual), 0) > 0
        ORDER BY value DESC
      ),
      wealth_evolution AS (
        SELECT
          s.mes_referencia AS month_start,
          to_char(s.mes_referencia, 'TMMon') AS month_label,
          s.patrimonio_total AS patrimonio,
          s.total_aportado AS aportado
        FROM investimentos_snapshots s
        WHERE s.usuario_id = $1
          AND s.mes_referencia >= (SELECT start_date FROM evolution_bounds)
        ORDER BY s.mes_referencia
      ),
      contributions_history AS (
        SELECT
          date_trunc('month', i.data_investimento)::date AS month_start,
          to_char(date_trunc('month', i.data_investimento)::date, 'TMMon') AS month_label,
          COALESCE(SUM(i.valor_inicial), 0) AS value,
          COUNT(*) AS count
        FROM investimentos i
        WHERE i.usuario_id = $1
        GROUP BY date_trunc('month', i.data_investimento)::date
        ORDER BY month_start
      ),
      investments_list AS (
        SELECT
          i.id,
          i.nome AS name,
          i.instituicao AS institution,
          ci.nome AS category,
          ci.cor AS color,
          ci.icone AS icon,
          i.valor_inicial AS invested,
          i.valor_atual AS current_value,
          i.valor_atual - i.valor_inicial AS profit,
          CASE
            WHEN i.valor_inicial > 0
            THEN ROUND(((i.valor_atual - i.valor_inicial) / i.valor_inicial * 100)::numeric, 2)
            ELSE 0
          END AS return_rate,
          i.data_investimento AS date
        FROM investimentos i
        JOIN categorias_investimentos ci ON ci.id = i.categoria_id
        WHERE i.usuario_id = $1
        ORDER BY i.valor_atual DESC, i.data_investimento DESC
      ),
      benchmarks AS (
        SELECT
          indice,
          mes_referencia AS month_start,
          to_char(mes_referencia, 'TMMon') AS month_label,
          valor_mensal AS monthly_rate
        FROM indices_financeiros
        WHERE mes_referencia >= (SELECT start_date FROM evolution_bounds)
        ORDER BY mes_referencia, indice
      )
    SELECT json_build_object(
      'portfolioCurrent', (SELECT row_to_json(p) FROM portfolio_current p),
      'distribution', COALESCE((
        SELECT json_agg(
          json_build_object(
            'category', category,
            'color', color,
            'icon', icon,
            'value', value,
            'count', count
          )
          ORDER BY value DESC
        ) FROM distribution
      ), '[]'::json),
      'wealthEvolution', COALESCE((
        SELECT json_agg(
          json_build_object(
            'month', month_label,
            'monthStart', month_start,
            'patrimonio', patrimonio,
            'aportado', aportado
          )
          ORDER BY month_start
        ) FROM wealth_evolution
      ), '[]'::json),
      'contributionsHistory', COALESCE((
        SELECT json_agg(
          json_build_object(
            'month', month_label,
            'monthStart', month_start,
            'value', value,
            'count', count
          )
          ORDER BY month_start
        ) FROM contributions_history
      ), '[]'::json),
      'investments', COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', id,
            'name', name,
            'institution', institution,
            'category', category,
            'color', color,
            'icon', icon,
            'invested', invested,
            'currentValue', current_value,
            'profit', profit,
            'returnRate', return_rate,
            'date', date
          )
        ) FROM investments_list
      ), '[]'::json),
      'benchmarks', COALESCE((
        SELECT json_agg(
          json_build_object(
            'index', indice,
            'month', month_label,
            'monthStart', month_start,
            'monthlyRate', monthly_rate
          )
          ORDER BY month_start, indice
        ) FROM benchmarks
      ), '[]'::json)
    ) AS payload
  `;
}

module.exports = { buildInvestmentsQuery };
