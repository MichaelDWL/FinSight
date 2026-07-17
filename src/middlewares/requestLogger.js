const { parseDeviceInfo } = require("../utils/requestMeta");
const logger = require("../utils/logger");

function requestLogger(req, res, next) {
  const started = Date.now();
  const meta = parseDeviceInfo(req);

  res.on("finish", () => {
    logger.info("HTTP", {
      type: "http",
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - started,
      userId: req.user?.id || null,
      ip: meta.ip,
      sqlCount: res.getHeader?.("X-BFF-SQL-Count") || null,
      cache: res.getHeader?.("X-BFF-Cache") || null,
    });
  });

  next();
}

module.exports = requestLogger;
