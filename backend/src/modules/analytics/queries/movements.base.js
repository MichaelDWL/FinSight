const BOUNDS_CTE = `
  bounds AS (
    SELECT
      $2::date AS start_date,
      $3::date AS end_date,
      $4::date AS prev_start,
      $5::date AS prev_end
  )
`;

const EVOLUTION_BOUNDS_CTE = `
  evolution_bounds AS (
    SELECT
      (date_trunc('month', (SELECT end_date FROM bounds)::timestamp) - (($6::int - 1) * interval '1 month'))::date AS start_date,
      (SELECT end_date FROM bounds) AS end_date
  )
`;

module.exports = { BOUNDS_CTE, EVOLUTION_BOUNDS_CTE };
