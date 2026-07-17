const asyncHandler = require("../../utils/asyncHandler");
const { getCurrentUserId } = require("../../utils/demoUser");
const { success } = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const recurrenceService = require("../../services/recurrenceService");

const list = asyncHandler(async (req, res) => {
  const data = await recurrenceService.list(getCurrentUserId(req));
  return success(res, { message: "Recorrencias carregadas.", data });
});

const remove = asyncHandler(async (req, res) => {
  const removed = await recurrenceService.deactivate(getCurrentUserId(req), req.params.id);
  if (!removed) throw new AppError("Recorrencia nao encontrada.", 404);
  return success(res, { message: "Recorrencia desativada com sucesso.", data: { id: req.params.id } });
});

module.exports = { list, remove };
