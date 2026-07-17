const { UAParser } = require("ua-parser-js");

function parseDeviceInfo(req) {
  const ua = req.headers["user-agent"] || "";
  const parser = new UAParser(ua);
  const result = parser.getResult();

  const browser = [result.browser.name, result.browser.version].filter(Boolean).join(" ") || "Desconhecido";
  const os = [result.os.name, result.os.version].filter(Boolean).join(" ") || "Desconhecido";
  const deviceType = result.device.type || "desktop";
  const device = result.device.model
    ? `${result.device.vendor || ""} ${result.device.model}`.trim()
    : deviceType;

  return {
    device,
    browser,
    operatingSystem: os,
    userAgent: ua.slice(0, 512),
    ip: getClientIp(req),
  };
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

module.exports = { parseDeviceInfo, getClientIp };
