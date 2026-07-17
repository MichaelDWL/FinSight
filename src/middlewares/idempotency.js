const pool = require("../database/pool");
const AppError = require("../utils/AppError");

const IDEMPOTENCY_TTL_HOURS = 24;
const HEADER = "idempotency-key";

/**
 * Protege POSTs criticos contra retries duplicados.
 * Header: Idempotency-Key (UUID ou string 8–128 chars).
 * Em hit: devolve a resposta cacheada com o mesmo status.
 */
function idempotency(options = {}) {
  const required = options.required !== false;

  return async function idempotencyMiddleware(req, res, next) {
    const key = String(req.headers[HEADER] || "").trim();
    if (!key) {
      if (required) {
        return next(
          new AppError("Header Idempotency-Key obrigatorio para esta operacao.", 400)
        );
      }
      return next();
    }

    if (key.length < 8 || key.length > 128) {
      return next(new AppError("Idempotency-Key invalida.", 400));
    }

    if (!req.user?.id) {
      return next(new AppError("Autenticacao necessaria.", 401));
    }

    const userId = req.user.id;
    const method = req.method;
    const path = req.originalUrl?.split("?")[0] || req.path;

    try {
      const existing = await pool.query(
        `
          SELECT status_code, response_body, expires_at
            FROM idempotency_keys
           WHERE usuario_id = $1 AND chave = $2
           LIMIT 1
        `,
        [userId, key]
      );

      if (existing.rowCount > 0) {
        const row = existing.rows[0];
        if (new Date(row.expires_at) < new Date()) {
          await pool.query(
            `DELETE FROM idempotency_keys WHERE usuario_id = $1 AND chave = $2`,
            [userId, key]
          );
        } else if (row.status_code && row.response_body !== null) {
          res.setHeader("Idempotency-Replayed", "true");
          return res.status(row.status_code).json(row.response_body);
        } else {
          return next(
            new AppError("Requisicao idempotente ainda em processamento.", 409)
          );
        }
      }

      await pool.query(
        `
          INSERT INTO idempotency_keys (
            usuario_id, chave, metodo, path, expires_at
          ) VALUES ($1, $2, $3, $4, now() + ($5 || ' hours')::interval)
          ON CONFLICT (usuario_id, chave) DO NOTHING
        `,
        [userId, key, method, path, String(IDEMPOTENCY_TTL_HOURS)]
      );

      const originalJson = res.json.bind(res);
      res.json = function captureJson(body) {
        const statusCode = res.statusCode || 200;
        pool
          .query(
            `
              UPDATE idempotency_keys
                 SET status_code = $3, response_body = $4::jsonb
               WHERE usuario_id = $1 AND chave = $2
            `,
            [userId, key, statusCode, JSON.stringify(body)]
          )
          .catch(() => null);
        return originalJson(body);
      };

      req.idempotencyKey = key;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { idempotency, HEADER };
