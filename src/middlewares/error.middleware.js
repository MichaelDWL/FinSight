const { fail } = require("../utils/apiResponse");
const logger = require("../utils/logger");

function notFoundMiddleware(req, res) {
  return fail(res, {
    statusCode: 404,
    message: `Rota nao encontrada: ${req.originalUrl}`,
  });
}

function errorMiddleware(error, req, res, _next) {
  const statusCode = error.statusCode || 500;
  const message = error.isOperational ? error.message : "Erro interno do servidor.";

  logger.error("Erro na requisicao", {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    error: error.message,
  });

  return fail(res, {
    statusCode,
    message,
  });
}

module.exports = { notFoundMiddleware, errorMiddleware };
