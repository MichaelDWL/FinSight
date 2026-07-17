/**
 * Catch-all Serverless Function — apenas adapta HTTP → Express.
 * Nenhuma regra de negocio aqui.
 */

process.env.RUNTIME = process.env.RUNTIME || "serverless";

module.exports = require("../src/platform/httpHandler");
