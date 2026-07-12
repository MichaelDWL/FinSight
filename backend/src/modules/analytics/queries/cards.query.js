const { BOUNDS_CTE, EVOLUTION_BOUNDS_CTE } = require("./movements.base");

function buildCardsQuery() {
  return `
    WITH
      ${BOUNDS_CTE},
      ${EVOLUTION_BOUNDS_CTE},
      cards_snapshot AS (
        SELECT
          c.id,
          c.nome AS name,
          c.cor AS color,
          c.bandeira AS brand,
          c.ultimos_digitos AS last_digits,
          c.limite_total AS total_limit,
          c.limite_disponivel AS available_limit,
          GREATEST(c.limite_total - c.limite_disponivel, 0) AS used_limit,
          c.dia_fechamento AS closing_day,
          c.dia_vencimento AS due_day,
          f.id AS current_invoice_id,
          f.valor_total AS current_invoice_total,
          f.data_vencimento AS current_invoice_due,
          f.status AS current_invoice_status
        FROM cartoes c
        LEFT JOIN faturas f
          ON f.cartao_id = c.id
          AND f.mes_referencia = date_trunc('month', CURRENT_DATE)::date
        WHERE c.usuario_id = $1
          AND c.status = 'ativa'
        ORDER BY c.created_at ASC
      ),
      limit_totals AS (
        SELECT
          COALESCE(SUM(total_limit), 0) AS total_limit,
          COALESCE(SUM(available_limit), 0) AS available_limit,
          COALESCE(SUM(used_limit), 0) AS used_limit
        FROM cards_snapshot
      ),
      invoice_evolution AS (
        SELECT
          f.mes_referencia AS month_start,
          to_char(f.mes_referencia, 'TMMon') AS month_label,
          c.id AS card_id,
          c.nome AS card_name,
          c.cor AS card_color,
          COALESCE(SUM(f.valor_total), 0) AS total
        FROM faturas f
        JOIN cartoes c ON c.id = f.cartao_id
        WHERE f.usuario_id = $1
          AND f.mes_referencia >= (SELECT start_date FROM evolution_bounds)
        GROUP BY f.mes_referencia, c.id, c.nome, c.cor
        ORDER BY f.mes_referencia, c.nome
      ),
      purchases_by_category AS (
        SELECT
          v.categoria_nome AS category,
          v.categoria_cor AS color,
          COALESCE(SUM(v.valor), 0) AS total
        FROM vw_analytics_movimentacoes v, bounds b
        WHERE v.usuario_id = $1
          AND v.cartao_id IS NOT NULL
          AND v.is_despesa_periodo
          AND v.data_transacao BETWEEN b.start_date AND b.end_date
        GROUP BY v.categoria_nome, v.categoria_cor
        HAVING COALESCE(SUM(v.valor), 0) > 0
        ORDER BY total DESC
      ),
      installments_summary AS (
        SELECT
          COALESCE(COUNT(*) FILTER (WHERE p.status = 'pendente'), 0) AS pending_count,
          COALESCE(SUM(p.valor) FILTER (WHERE p.status = 'pendente'), 0) AS pending_total,
          COALESCE(COUNT(DISTINCT p.movimentacao_id), 0) AS purchase_count,
          COALESCE(SUM(p.valor), 0) AS total_value
        FROM parcelas p
        WHERE p.usuario_id = $1
      ),
      future_installments AS (
        SELECT
          p.id,
          p.numero,
          p.total,
          p.valor AS value,
          p.data_vencimento AS due_date,
          p.status,
          m.descricao AS description,
          m.cartao_id AS card_id,
          c.nome AS card_name,
          c.cor AS card_color
        FROM parcelas p
        JOIN movimentacoes m ON m.id = p.movimentacao_id
        LEFT JOIN cartoes c ON c.id = m.cartao_id
        WHERE p.usuario_id = $1
          AND p.status = 'pendente'
          AND p.data_vencimento >= CURRENT_DATE
        ORDER BY p.data_vencimento ASC, p.numero ASC
        LIMIT 15
      ),
      upcoming_invoices AS (
        SELECT
          c.id AS card_id,
          c.nome AS card_name,
          c.cor AS card_color,
          f.id AS invoice_id,
          f.mes_referencia AS reference_month,
          f.data_fechamento AS closing_date,
          f.data_vencimento AS due_date,
          f.valor_total AS total,
          f.valor_pago AS paid,
          f.status
        FROM faturas f
        JOIN cartoes c ON c.id = f.cartao_id
        WHERE f.usuario_id = $1
          AND f.status IN ('aberta', 'fechada', 'atrasada')
          AND f.data_vencimento >= CURRENT_DATE
        ORDER BY f.data_vencimento ASC
        LIMIT 10
      ),
      period_card_spending AS (
        SELECT COALESCE(SUM(v.valor), 0) AS total
        FROM vw_analytics_movimentacoes v, bounds b
        WHERE v.usuario_id = $1
          AND v.cartao_id IS NOT NULL
          AND v.is_despesa_periodo
          AND v.data_transacao BETWEEN b.start_date AND b.end_date
      )
    SELECT json_build_object(
      'cards', COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', id,
            'name', name,
            'color', color,
            'brand', brand,
            'lastDigits', last_digits,
            'totalLimit', total_limit,
            'availableLimit', available_limit,
            'usedLimit', used_limit,
            'closingDay', closing_day,
            'dueDay', due_day,
            'currentInvoice', json_build_object(
              'id', current_invoice_id,
              'total', current_invoice_total,
              'dueDate', current_invoice_due,
              'status', current_invoice_status
            )
          )
        ) FROM cards_snapshot
      ), '[]'::json),
      'limitTotals', (SELECT row_to_json(l) FROM limit_totals l),
      'periodSpending', (SELECT total FROM period_card_spending),
      'invoiceEvolution', COALESCE((
        SELECT json_agg(
          json_build_object(
            'month', month_label,
            'monthStart', month_start,
            'cardId', card_id,
            'cardName', card_name,
            'cardColor', card_color,
            'value', total
          )
          ORDER BY month_start, card_name
        ) FROM invoice_evolution
      ), '[]'::json),
      'purchasesByCategory', COALESCE((
        SELECT json_agg(
          json_build_object('category', category, 'color', color, 'value', total)
          ORDER BY total DESC
        ) FROM purchases_by_category
      ), '[]'::json),
      'installmentsSummary', (SELECT row_to_json(i) FROM installments_summary i),
      'futureInstallments', COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', id,
            'installment', numero,
            'total', total,
            'value', value,
            'dueDate', due_date,
            'status', status,
            'description', description,
            'cardId', card_id,
            'cardName', card_name,
            'cardColor', card_color
          )
        ) FROM future_installments
      ), '[]'::json),
      'upcomingInvoices', COALESCE((
        SELECT json_agg(
          json_build_object(
            'cardId', card_id,
            'cardName', card_name,
            'cardColor', card_color,
            'invoiceId', invoice_id,
            'referenceMonth', reference_month,
            'closingDate', closing_date,
            'dueDate', due_date,
            'total', total,
            'paid', paid,
            'status', status
          )
        ) FROM upcoming_invoices
      ), '[]'::json)
    ) AS payload
  `;
}

module.exports = { buildCardsQuery };
