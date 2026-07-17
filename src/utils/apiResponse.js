function success(res, { statusCode = 200, message = "Operacao realizada com sucesso.", data = null } = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function fail(res, { statusCode = 400, message = "Nao foi possivel concluir a operacao." } = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = { success, fail };
