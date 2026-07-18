/**
 * Deteccao de runtime — sem acoplar negocio a Vercel/AWS/etc.
 * Em long-running (Docker, Railway, VPS): listen + cron opcional.
 * Em serverless: bootstrap lazy por invocacao, sem listen/node-cron.
 */

function detectRuntime() {
  if (process.env.RUNTIME === "serverless") return "serverless";
  if (process.env.RUNTIME === "long") return "long";

  if (
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.FUNCTIONS_WORKER_RUNTIME ||
    process.env.NETLIFY
  ) {
    return "serverless";
  }

  return "long";
}

const runtime = detectRuntime();
const isServerless = runtime === "serverless";
const isLongRunning = runtime === "long";

module.exports = {
  runtime,
  isServerless,
  isLongRunning,
  detectRuntime,
};
