function info(message, meta = {}) {
  console.info(JSON.stringify({ level: "info", message, ...meta, timestamp: new Date().toISOString() }));
}

function warn(message, meta = {}) {
  console.warn(JSON.stringify({ level: "warn", message, ...meta, timestamp: new Date().toISOString() }));
}

function error(message, meta = {}) {
  console.error(JSON.stringify({ level: "error", message, ...meta, timestamp: new Date().toISOString() }));
}

module.exports = { info, warn, error };
