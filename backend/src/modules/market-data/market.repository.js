const pool = require("../../database/pool");

function mapMarketRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    assetCode: row.asset_code,
    assetName: row.asset_name,
    assetType: row.asset_type,
    currentPrice: Number(row.current_price),
    currency: row.currency,
    dailyChange: row.daily_change != null ? Number(row.daily_change) : null,
    monthlyChange: row.monthly_change != null ? Number(row.monthly_change) : null,
    yearlyChange: row.yearly_change != null ? Number(row.yearly_change) : null,
    source: row.source,
    lastUpdate: row.last_update,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRatesRow(row) {
  if (!row) return null;
  return {
    selic: row.selic != null ? Number(row.selic) : null,
    ipca: row.ipca != null ? Number(row.ipca) : null,
    cdi: row.cdi != null ? Number(row.cdi) : null,
    dolar: row.dolar != null ? Number(row.dolar) : null,
    euro: row.euro != null ? Number(row.euro) : null,
    lastUpdate: row.last_update,
    createdAt: row.created_at,
  };
}

function mapWatchlistRow(row) {
  if (!row) return null;
  const symbols =
    row.symbols && typeof row.symbols === "object"
      ? row.symbols
      : row.stooq_symbol
        ? { stooq: row.stooq_symbol, brapi: row.asset_code }
        : {};

  return {
    assetCode: row.asset_code || row.assetCode,
    assetName: row.asset_name || row.assetName,
    assetType: row.asset_type || row.assetType,
    stooqSymbol: row.stooq_symbol || row.stooqSymbol || symbols.stooq || null,
    symbols,
    active: row.active,
  };
}

async function getEconomicRates() {
  const { rows } = await pool.query("SELECT * FROM economic_rates WHERE id = 1");
  return mapRatesRow(rows[0]);
}

async function upsertEconomicRates(rates) {
  const { rows } = await pool.query(
    `
      INSERT INTO economic_rates (id, selic, ipca, cdi, dolar, euro, last_update, created_at)
      VALUES (
        1,
        $1, $2, $3, $4, $5, now(), now()
      )
      ON CONFLICT (id) DO UPDATE SET
        selic = COALESCE(EXCLUDED.selic, economic_rates.selic),
        ipca = COALESCE(EXCLUDED.ipca, economic_rates.ipca),
        cdi = COALESCE(EXCLUDED.cdi, economic_rates.cdi),
        dolar = COALESCE(EXCLUDED.dolar, economic_rates.dolar),
        euro = COALESCE(EXCLUDED.euro, economic_rates.euro),
        last_update = now()
      RETURNING *
    `,
    [rates.selic ?? null, rates.ipca ?? null, rates.cdi ?? null, rates.dolar ?? null, rates.euro ?? null]
  );
  return mapRatesRow(rows[0]);
}

async function insertEconomicHistory(indicator, value, referenceDate) {
  const { rows } = await pool.query(
    `
      INSERT INTO economic_history (indicator, value, reference_date)
      VALUES ($1, $2, $3::date)
      ON CONFLICT (indicator, reference_date) DO UPDATE SET
        value = EXCLUDED.value
      RETURNING id, indicator, value, reference_date AS "referenceDate", created_at AS "createdAt"
    `,
    [indicator, value, referenceDate]
  );
  return rows[0];
}

async function getEconomicHistory(indicator, { limit = 24 } = {}) {
  const { rows } = await pool.query(
    `
      SELECT indicator, value, reference_date AS "referenceDate", created_at AS "createdAt"
      FROM economic_history
      WHERE ($1::text IS NULL OR indicator = $1)
      ORDER BY reference_date DESC
      LIMIT $2
    `,
    [indicator || null, limit]
  );
  return rows.map((row) => ({
    ...row,
    value: Number(row.value),
  }));
}

async function hasEconomicHistory(indicator, referenceDate) {
  const { rows } = await pool.query(
    `
      SELECT 1
      FROM economic_history
      WHERE indicator = $1 AND reference_date = $2::date
      LIMIT 1
    `,
    [indicator, referenceDate]
  );
  return rows.length > 0;
}

async function listWatchlist({ activeOnly = true } = {}) {
  const { rows } = await pool.query(
    `
      SELECT asset_code, asset_name, asset_type, stooq_symbol, symbols, active
      FROM market_watchlist
      WHERE ($1::boolean = false OR active = true)
      ORDER BY asset_type, asset_code
    `,
    [activeOnly]
  );
  return rows.map(mapWatchlistRow);
}

async function upsertWatchlistItem(item) {
  const assetCode = String(item.assetCode).toUpperCase();
  const symbols = {
    brapi: item.symbols?.brapi || item.brapiSymbol || assetCode,
    stooq: item.symbols?.stooq || item.stooqSymbol || `${assetCode.toLowerCase()}.br`,
    ...(item.symbols || {}),
  };

  const { rows } = await pool.query(
    `
      INSERT INTO market_watchlist (asset_code, asset_name, asset_type, stooq_symbol, symbols, active)
      VALUES ($1, $2, $3, $4, $5::jsonb, true)
      ON CONFLICT (asset_code) DO UPDATE SET
        asset_name = EXCLUDED.asset_name,
        asset_type = EXCLUDED.asset_type,
        stooq_symbol = EXCLUDED.stooq_symbol,
        symbols = EXCLUDED.symbols,
        active = true
      RETURNING asset_code, asset_name, asset_type, stooq_symbol, symbols, active
    `,
    [
      assetCode,
      item.assetName || assetCode,
      item.assetType || "stock",
      String(symbols.stooq).toLowerCase(),
      JSON.stringify(symbols),
    ]
  );
  return mapWatchlistRow(rows[0]);
}

async function listDistinctUserAssetCodes() {
  const { rows } = await pool.query(`
    SELECT DISTINCT UPPER(asset_code) AS asset_code
    FROM investimentos
    WHERE asset_code IS NOT NULL AND TRIM(asset_code) <> ''
  `);
  return rows.map((row) => row.asset_code);
}

async function upsertMarketData(asset) {
  const { rows } = await pool.query(
    `
      INSERT INTO market_data (
        asset_code, asset_name, asset_type, current_price, currency,
        daily_change, monthly_change, yearly_change, source, last_update
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
      ON CONFLICT (asset_code) DO UPDATE SET
        asset_name = EXCLUDED.asset_name,
        asset_type = EXCLUDED.asset_type,
        current_price = EXCLUDED.current_price,
        currency = EXCLUDED.currency,
        daily_change = EXCLUDED.daily_change,
        monthly_change = EXCLUDED.monthly_change,
        yearly_change = EXCLUDED.yearly_change,
        source = EXCLUDED.source,
        last_update = now(),
        updated_at = now()
      RETURNING *
    `,
    [
      asset.assetCode,
      asset.assetName,
      asset.assetType,
      asset.currentPrice,
      asset.currency || "BRL",
      asset.dailyChange,
      asset.monthlyChange,
      asset.yearlyChange,
      asset.source || asset.provider || "cache",
    ]
  );
  return mapMarketRow(rows[0]);
}

async function insertMarketHistory(assetCode, price, date, { provider = null, source = null } = {}) {
  await pool.query(
    `
      INSERT INTO market_history (asset_code, price, date, provider, source)
      VALUES ($1, $2, $3::date, $4, $5)
      ON CONFLICT (asset_code, date) DO UPDATE SET
        price = EXCLUDED.price,
        provider = COALESCE(EXCLUDED.provider, market_history.provider),
        source = COALESCE(EXCLUDED.source, market_history.source)
    `,
    [assetCode, price, date, provider, source]
  );
}

async function insertMarketHistoryBatch(assetCode, points, { provider = null, source = null } = {}) {
  if (!points?.length) return;
  const values = [];
  const params = [];
  let idx = 1;

  for (const point of points) {
    values.push(`($${idx++}, $${idx++}, $${idx++}::date, $${idx++}, $${idx++})`);
    params.push(assetCode, point.price, point.date, point.provider || provider, point.source || source);
  }

  await pool.query(
    `
      INSERT INTO market_history (asset_code, price, date, provider, source)
      VALUES ${values.join(", ")}
      ON CONFLICT (asset_code, date) DO UPDATE SET
        price = EXCLUDED.price,
        provider = COALESCE(EXCLUDED.provider, market_history.provider),
        source = COALESCE(EXCLUDED.source, market_history.source)
    `,
    params
  );
}

async function insertQuoteLog({
  assetCode,
  price,
  currency = "BRL",
  provider,
  source,
  quoteDate,
  quoteTime = null,
}) {
  await pool.query(
    `
      INSERT INTO market_quote_log (
        asset_code, price, currency, provider, source, quote_date, quote_time
      )
      VALUES ($1, $2, $3, $4, $5, $6::date, COALESCE($7::timestamptz, now()))
    `,
    [assetCode, price, currency, provider, source || provider, quoteDate, quoteTime]
  );
}

async function getMarketDataByCode(assetCode) {
  const { rows } = await pool.query("SELECT * FROM market_data WHERE asset_code = $1", [
    String(assetCode).toUpperCase(),
  ]);
  return mapMarketRow(rows[0]);
}

async function listMarketData({ assetType } = {}) {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM market_data
      WHERE ($1::text IS NULL OR asset_type = $1)
      ORDER BY asset_type, asset_code
    `,
    [assetType || null]
  );
  return rows.map(mapMarketRow);
}

async function getMarketHistory(assetCode, { limit = 365 } = {}) {
  const { rows } = await pool.query(
    `
      SELECT price, date, provider, source, created_at AS "createdAt"
      FROM market_history
      WHERE asset_code = $1
      ORDER BY date DESC
      LIMIT $2
    `,
    [String(assetCode).toUpperCase(), limit]
  );

  return rows
    .map((row) => ({
      price: Number(row.price),
      date: row.date,
      provider: row.provider || null,
      source: row.source || null,
      createdAt: row.createdAt,
    }))
    .reverse();
}

async function getMarketStats(assetCode) {
  const { rows } = await pool.query(
    `
      SELECT
        MIN(price) AS min_price,
        MAX(price) AS max_price,
        AVG(price) AS avg_price,
        COUNT(*)::int AS points
      FROM market_history
      WHERE asset_code = $1
    `,
    [String(assetCode).toUpperCase()]
  );

  const row = rows[0];
  return {
    minPrice: row?.min_price != null ? Number(row.min_price) : null,
    maxPrice: row?.max_price != null ? Number(row.max_price) : null,
    avgPrice: row?.avg_price != null ? Number(row.avg_price) : null,
    points: row?.points || 0,
  };
}

async function syncLegacyIndicesFromRates(rates) {
  if (!rates) return;

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  const mes = monthStart.toISOString().slice(0, 10);

  const entries = [];
  if (rates.cdi != null) entries.push(["CDI", rates.cdi / 12]);
  if (rates.selic != null) entries.push(["SELIC", rates.selic / 12]);
  if (rates.ipca != null) entries.push(["IPCA", rates.ipca]);

  for (const [indice, valorMensal] of entries) {
    await pool.query(
      `
        INSERT INTO indices_financeiros (indice, mes_referencia, valor_mensal)
        VALUES ($1, $2::date, $3)
        ON CONFLICT (indice, mes_referencia) DO UPDATE SET
          valor_mensal = EXCLUDED.valor_mensal
      `,
      [indice, mes, Number(valorMensal.toFixed(4))]
    );
  }
}

async function upsertProviderStatus({
  provider,
  status,
  lastSuccess = null,
  lastError = null,
  responseTime = null,
}) {
  const { rows } = await pool.query(
    `
      INSERT INTO market_provider_status (
        provider, status, last_success, last_error, response_time, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (provider) DO UPDATE SET
        status = EXCLUDED.status,
        last_success = COALESCE(EXCLUDED.last_success, market_provider_status.last_success),
        last_error = EXCLUDED.last_error,
        response_time = COALESCE(EXCLUDED.response_time, market_provider_status.response_time),
        updated_at = now()
      RETURNING
        provider,
        status,
        last_success AS "lastSuccess",
        last_error AS "lastError",
        response_time AS "responseTime",
        updated_at AS "updatedAt"
    `,
    [provider, status, lastSuccess, lastError, responseTime]
  );
  return rows[0];
}

async function listProviderStatus() {
  const { rows } = await pool.query(
    `
      SELECT
        provider,
        status,
        last_success AS "lastSuccess",
        last_error AS "lastError",
        response_time AS "responseTime",
        updated_at AS "updatedAt"
      FROM market_provider_status
      ORDER BY provider
    `
  );
  return rows;
}

async function getProviderStatus(provider) {
  const { rows } = await pool.query(
    `
      SELECT
        provider,
        status,
        last_success AS "lastSuccess",
        last_error AS "lastError",
        response_time AS "responseTime",
        updated_at AS "updatedAt"
      FROM market_provider_status
      WHERE provider = $1
    `,
    [provider]
  );
  return rows[0] || null;
}

module.exports = {
  getEconomicHistory,
  getEconomicRates,
  getMarketDataByCode,
  getMarketHistory,
  getMarketStats,
  getProviderStatus,
  hasEconomicHistory,
  insertEconomicHistory,
  insertMarketHistory,
  insertMarketHistoryBatch,
  insertQuoteLog,
  listMarketData,
  listProviderStatus,
  listWatchlist,
  listDistinctUserAssetCodes,
  syncLegacyIndicesFromRates,
  upsertEconomicRates,
  upsertMarketData,
  upsertProviderStatus,
  upsertWatchlistItem,
};
