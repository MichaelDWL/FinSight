const pool = require("../../database/pool");
const { paginationService } = require("../../services/pagination/PaginationService");
const paginationConfig = require("../../config/pagination.config");

const INVESTMENT_COLUMNS = `
  i.id, i.usuario_id, i.categoria_id, i.nome, i.instituicao,
  i.valor_inicial, i.valor_atual, i.data_investimento, i.observacao,
  i.tipo_investimento, i.asset_code, i.quantidade,
  i.percentual_cdi, i.taxa_prefixada, i.taxa_ipca_spread, i.moeda,
  i.created_at, i.updated_at
`;

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
    categoryId: row.categoria_id,
    investmentType: row.tipo_investimento || null,
    assetCode: row.asset_code || null,
    quantity: row.quantidade != null ? Number(row.quantidade) : null,
    cdiPercent: row.percentual_cdi != null ? Number(row.percentual_cdi) : null,
    prefixedRate: row.taxa_prefixada != null ? Number(row.taxa_prefixada) : null,
    ipcaSpread: row.taxa_ipca_spread != null ? Number(row.taxa_ipca_spread) : null,
    currency: row.moeda || "BRL",
    invested: initialValue,
    value: currentValue,
    profit,
    returnRate: initialValue > 0 ? Number(((profit / initialValue) * 100).toFixed(2)) : 0,
    date: row.data_investimento,
    notes: row.observacao,
    marketPrice: row.market_price != null ? Number(row.market_price) : null,
    marketDailyChange: row.market_daily_change != null ? Number(row.market_daily_change) : null,
    marketLastUpdate: row.market_last_update || null,
  };
}

async function findAll(userId, options = {}) {
  const pagination =
    options.pagination ||
    paginationService.parseFromQuery(
      {
        page: options.page || 1,
        pageSize: options.pageSize ?? paginationConfig.pageSize.max,
        sort: options.sort,
        order: options.order,
      },
      { resource: "investments", defaultSort: "date" }
    );

  const order = paginationService.resolveOrderBy(
    pagination,
    "i.data_investimento DESC, i.created_at DESC"
  );

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM investimentos WHERE usuario_id = $1`,
    [userId]
  );

  const { rows } = await pool.query(
    `
      SELECT
        ${INVESTMENT_COLUMNS},
        ci.nome AS categoria,
        ci.icone,
        md.current_price AS market_price,
        md.daily_change AS market_daily_change,
        md.last_update AS market_last_update
      FROM investimentos i
      INNER JOIN categorias_investimentos ci ON ci.id = i.categoria_id
      LEFT JOIN market_data md ON md.asset_code = i.asset_code
      WHERE i.usuario_id = $1
      ORDER BY ${order.clause}
      LIMIT $2 OFFSET $3
    `,
    [userId, pagination.limit, pagination.offset]
  );

  return {
    items: rows.map(mapInvestment),
    ...paginationService.toMeta(pagination, countResult.rows[0].total),
  };
}

async function findById(userId, id) {
  const { rows } = await pool.query(
    `
      SELECT
        ${INVESTMENT_COLUMNS},
        ci.nome AS categoria,
        ci.icone,
        md.current_price AS market_price,
        md.daily_change AS market_daily_change,
        md.last_update AS market_last_update
      FROM investimentos i
      INNER JOIN categorias_investimentos ci ON ci.id = i.categoria_id
      LEFT JOIN market_data md ON md.asset_code = i.asset_code
      WHERE i.usuario_id = $1 AND i.id = $2
    `,
    [userId, id]
  );

  return rows[0] ? mapInvestment(rows[0]) : null;
}

async function getDefaultCategoryId() {
  const { rows } = await pool.query(
    "SELECT id FROM categorias_investimentos WHERE nome = 'Outros' ORDER BY created_at ASC LIMIT 1"
  );
  return rows[0]?.id;
}

async function getCategoryIdByName(name) {
  const { rows } = await pool.query(
    "SELECT id FROM categorias_investimentos WHERE nome = $1 ORDER BY created_at ASC LIMIT 1",
    [name]
  );
  return rows[0]?.id || null;
}

async function getCategoryNameById(categoryId) {
  if (!categoryId) return null;
  const { rows } = await pool.query("SELECT nome FROM categorias_investimentos WHERE id = $1", [
    categoryId,
  ]);
  return rows[0]?.nome || null;
}

async function create(userId, payload) {
  const categoryId = payload.categoryId || (await getDefaultCategoryId());

  const { rows } = await pool.query(
    `
      INSERT INTO investimentos (
        usuario_id, categoria_id, nome, instituicao, valor_inicial,
        valor_atual, data_investimento, observacao,
        tipo_investimento, asset_code, quantidade,
        percentual_cdi, taxa_prefixada, taxa_ipca_spread, moeda
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
      payload.investmentType || null,
      payload.assetCode ? String(payload.assetCode).toUpperCase() : null,
      payload.quantity ?? null,
      payload.cdiPercent ?? null,
      payload.prefixedRate ?? null,
      payload.ipcaSpread ?? null,
      payload.currency || "BRL",
    ]
  );

  return findById(userId, rows[0].id);
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
        categoria_id = COALESCE($9, categoria_id),
        tipo_investimento = COALESCE($10, tipo_investimento),
        asset_code = COALESCE($11, asset_code),
        quantidade = COALESCE($12, quantidade),
        percentual_cdi = COALESCE($13, percentual_cdi),
        taxa_prefixada = COALESCE($14, taxa_prefixada),
        taxa_ipca_spread = COALESCE($15, taxa_ipca_spread),
        moeda = COALESCE($16, moeda),
        updated_at = now()
      WHERE usuario_id = $1 AND id = $2
      RETURNING id
    `,
    [
      userId,
      id,
      payload.name,
      payload.institution,
      payload.invested,
      payload.value,
      payload.date,
      payload.notes,
      payload.categoryId,
      payload.investmentType,
      payload.assetCode ? String(payload.assetCode).toUpperCase() : payload.assetCode,
      payload.quantity,
      payload.cdiPercent,
      payload.prefixedRate,
      payload.ipcaSpread,
      payload.currency,
    ]
  );

  if (!rows[0]) return null;
  return findById(userId, id);
}

async function remove(userId, id) {
  const { rowCount } = await pool.query("DELETE FROM investimentos WHERE usuario_id = $1 AND id = $2", [
    userId,
    id,
  ]);
  return rowCount > 0;
}

module.exports = {
  create,
  findAll,
  findById,
  getCategoryIdByName,
  getCategoryNameById,
  getDefaultCategoryId,
  remove,
  update,
};
