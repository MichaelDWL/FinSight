const pool = require("../../database/pool");

async function getFinancialSummary(userId) {
  const { rows } = await pool.query(
    `
      SELECT
        COALESCE((SELECT SUM(saldo_atual) FROM contas WHERE usuario_id = $1 AND status = 'ativa'), 0) AS balance,
        COALESCE((SELECT SUM(valor) FROM transacoes WHERE usuario_id = $1 AND tipo = 'receita' AND status IN ('confirmada', 'paga')), 0) AS income,
        COALESCE((SELECT SUM(valor) FROM transacoes WHERE usuario_id = $1 AND tipo IN ('despesa', 'recorrencia', 'compra_parcelada') AND status IN ('confirmada', 'paga', 'pendente')), 0) AS expenses,
        COALESCE((SELECT SUM(valor_atual) FROM investimentos WHERE usuario_id = $1), 0) AS investments,
        COALESCE((SELECT SUM(valor) FROM transacoes WHERE usuario_id = $1 AND tipo IN ('despesa', 'recorrencia', 'pagamento_fatura') AND status = 'pendente'), 0) AS pending_bills
    `,
    [userId]
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
  };
}

module.exports = { getFinancialSummary };
