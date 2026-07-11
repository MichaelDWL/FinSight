const pool = require("../../database/pool");

function mapInvestment(row) {
  const initialValue = Number(row.valor_inicial);
  const currentValue = Number(row.valor_atual);
  const profit = currentValue - initialValue;

  return {
    id: row.id,
    icon: row.icone || "fa-chart-line",
    name: row.nome,
    institution: row.instituicao || "Instituicao nao informada",
    type: row.categoria || "Outros",
    invested: initialValue,
    value: currentValue,
    profit,
    returnRate: initialValue > 0 ? Number(((profit / initialValue) * 100).toFixed(2)) : 0,
    date: row.data_investimento,
    notes: row.observacao,
  };
}

async function findAll(userId) {
  const { rows } = await pool.query(
    `
      SELECT i.*, ci.nome AS categoria, ci.icone
      FROM investimentos i
      INNER JOIN categorias_investimentos ci ON ci.id = i.categoria_id
      WHERE i.usuario_id = $1
      ORDER BY i.data_investimento DESC, i.created_at DESC
    `,
    [userId]
  );

  return rows.map(mapInvestment);
}

async function getDefaultCategoryId() {
  const { rows } = await pool.query(
    "SELECT id FROM categorias_investimentos WHERE nome = 'Outros' ORDER BY created_at ASC LIMIT 1"
  );
  return rows[0]?.id;
}

async function create(userId, payload) {
  const categoryId = payload.categoryId || (await getDefaultCategoryId());

  const { rows } = await pool.query(
    `
      INSERT INTO investimentos (
        usuario_id, categoria_id, nome, instituicao, valor_inicial,
        valor_atual, data_investimento, observacao
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `,
    [
      userId,
      categoryId,
      payload.name,
      payload.institution || null,
      payload.invested,
      payload.value || payload.invested,
      payload.date,
      payload.notes || null,
    ]
  );

  return rows[0];
}

async function update(userId, id, payload) {
  const { rows } = await pool.query(
    `
      UPDATE investimentos
      SET
        nome = COALESCE($3, nome),
        instituicao = COALESCE($4, instituicao),
        valor_inicial = COALESCE($5, valor_inicial),
        valor_atual = COALESCE($6, valor_atual),
        data_investimento = COALESCE($7, data_investimento),
        observacao = COALESCE($8, observacao),
        updated_at = now()
      WHERE usuario_id = $1 AND id = $2
      RETURNING id
    `,
    [userId, id, payload.name, payload.institution, payload.invested, payload.value, payload.date, payload.notes]
  );

  return rows[0] || null;
}

async function remove(userId, id) {
  const { rowCount } = await pool.query("DELETE FROM investimentos WHERE usuario_id = $1 AND id = $2", [userId, id]);
  return rowCount > 0;
}

module.exports = { create, findAll, remove, update };
