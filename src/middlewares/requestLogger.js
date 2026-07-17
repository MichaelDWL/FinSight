const crypto = require("crypto");
const { parseDeviceInfo } = require("../utils/requestMeta");
const logger = require("../utils/logger");

function requestLogger(req, res, next) {
  const started = Date.now();
  const meta = parseDeviceInfo(req);
  const requestId =
    req.headers["x-request-id"] ||
    req.headers["x-correlation-id"] ||
    crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    logger.info("HTTP", {
      type: "http",
      requestId,
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
