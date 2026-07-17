const { parseDeviceInfo } = require("../utils/requestMeta");
const logger = require("../utils/logger");

function requestLogger(req, res, next) {
  const started = Date.now();
  const meta = parseDeviceInfo(req);

  res.on("finish", () => {
    logger.info("HTTP", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - started,
      userId: req.user?.id || null,
      ip: meta.ip,
    });
  });

  next();
}

module.exports = requestLogger;
