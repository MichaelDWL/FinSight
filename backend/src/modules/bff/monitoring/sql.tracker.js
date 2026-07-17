const { AsyncLocalStorage } = require("async_hooks");

/**
 * Tracker de consultas SQL por request (AsyncLocalStorage).
 * Compativel com serverless: escopo por invocacao, sem estado global compartilhado.
 */
const sqlStorage = new AsyncLocalStorage();

function createSqlStats() {
  return {
    queryCount: 0,
    totalQueryMs: 0,
    rowCount: 0,
  };
}

function runWithSqlTracking(fn) {
  return sqlStorage.run(createSqlStats(), fn);
}

function getSqlStats() {
  return sqlStorage.getStore() || null;
}

function recordQuery({ durationMs = 0, rowCount = 0 } = {}) {
  const stats = sqlStorage.getStore();
  if (!stats) return;

  stats.queryCount += 1;
  stats.totalQueryMs += Number(durationMs) || 0;
  stats.rowCount += Number(rowCount) || 0;
}

module.exports = {
  runWithSqlTracking,
  getSqlStats,
  recordQuery,
  createSqlStats,
};
