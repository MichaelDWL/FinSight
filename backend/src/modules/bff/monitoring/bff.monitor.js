const logger = require("../../../utils/logger");
const { getSqlStats } = require("./sql.tracker");

/** Processo com uptime >= limiar e tratado como warm (nao e cold start serverless). */
const WARM_UPTIME_SECONDS = 5;

/**
 * Monitoramento de endpoints BFF.
 * Coleta: tempo total, SQL, serializacao e tamanho da resposta.
 * Headers: X-BFF-Duration-Ms, X-BFF-SQL-Count, X-BFF-Cache, X-BFF-Warm.
 */
function createBffMonitor(endpoint, { userId, cacheHit = false } = {}) {
  const startedAt = process.hrtime.bigint();
  let serializeMs = 0;
  let recordCount = 0;
  let sqlSnapshot = null;

  return {
    setCacheHit(value) {
      cacheHit = Boolean(value);
    },

    setRecordCount(count) {
      recordCount = Number(count) || 0;
    },

    /**
     * Deve ser chamado AINDA dentro de runWithSqlTracking().
     * Fora do ALS, getSqlStats() retorna null e o contador zera.
     */
    captureSql() {
      const sql = getSqlStats();
      sqlSnapshot = sql
        ? {
            queryCount: sql.queryCount,
            totalQueryMs: sql.totalQueryMs,
            rowCount: sql.rowCount,
          }
        : { queryCount: 0, totalQueryMs: 0, rowCount: 0 };
    },

    measureSerialize(fn) {
      const t0 = process.hrtime.bigint();
      const result = fn();
      serializeMs = Number(process.hrtime.bigint() - t0) / 1e6;
      return result;
    },

    finish(res, payload) {
      const totalMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const sql =
        sqlSnapshot || getSqlStats() || { queryCount: 0, totalQueryMs: 0, rowCount: 0 };
      const warm = process.uptime() >= WARM_UPTIME_SECONDS;

      const approxBytes = (() => {
        try {
          return Buffer.byteLength(JSON.stringify(payload ?? null), "utf8");
        } catch {
          return 0;
        }
      })();

      const metrics = {
        endpoint: `bff:${endpoint}`,
        userId,
        cacheHit,
        warm,
        processUptimeSec: Math.round(process.uptime() * 10) / 10,
        totalMs: Math.round(totalMs * 100) / 100,
        sqlQueryCount: sql.queryCount,
        sqlTotalMs: Math.round(sql.totalQueryMs * 100) / 100,
        sqlRowCount: sql.rowCount,
        recordCount,
        serializeMs: Math.round(serializeMs * 100) / 100,
        responseBytes: approxBytes,
        statusCode: res?.statusCode || 200,
      };

      logger.performance("BFF request metrics", {
        durationMs: metrics.totalMs,
        sqlCount: metrics.sqlQueryCount,
        rowCount: metrics.sqlRowCount,
        cacheHit: metrics.cacheHit,
        warm: metrics.warm,
        ...metrics,
      });

      if (res && !res.headersSent) {
        res.setHeader("X-BFF-Endpoint", endpoint);
        res.setHeader("X-BFF-Cache", cacheHit ? "HIT" : "MISS");
        res.setHeader("X-BFF-Duration-Ms", String(metrics.totalMs));
        res.setHeader("X-BFF-SQL-Count", String(metrics.sqlQueryCount));
        res.setHeader("X-BFF-SQL-Ms", String(metrics.sqlTotalMs));
        res.setHeader("X-BFF-Warm", warm ? "1" : "0");
      }

      return metrics;
    },
  };
}

function countRecords(value) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== "object") return 0;

  return Object.values(value).reduce((sum, item) => {
    if (Array.isArray(item)) return sum + item.length;
    if (item && typeof item === "object") return sum + countRecords(item);
    return sum;
  }, 0);
}

module.exports = {
  createBffMonitor,
  countRecords,
};
