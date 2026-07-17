/**
 * Logger estruturado — JSON em uma linha (compativel com Vercel/Railway/Docker).
 */

function base(level, message, meta = {}) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
  return entry;
}

function info(message, meta = {}) {
  return base("info", message, meta);
}

function warn(message, meta = {}) {
  return base("warn", message, meta);
}

function error(message, meta = {}) {
  return base("error", message, meta);
}

/**
 * Log de performance de request/handler (BFF, cron, etc.).
 */
function performance(message, meta = {}) {
  return base("info", message, {
    type: "performance",
    durationMs: meta.durationMs ?? null,
    sqlCount: meta.sqlCount ?? null,
    rowCount: meta.rowCount ?? null,
    cacheHit: meta.cacheHit ?? null,
    ...meta,
  });
}

module.exports = { info, warn, error, performance };
