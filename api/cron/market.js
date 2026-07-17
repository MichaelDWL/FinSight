/**
 * Entrypoint Cron (Vercel Cron / crontab HTTP).
 */

process.env.RUNTIME = process.env.RUNTIME || "serverless";

module.exports = require("../src/platform/httpHandler");
