const asyncHandler = require("../../utils/asyncHandler");
const { getCurrentUserId } = require("../../utils/demoUser");
const { success } = require("../../utils/apiResponse");
const service = require("./users.service");

const profile = asyncHandler(async (req, res) => {
  const data = await service.getProfile(getCurrentUserId(req));
  return success(res, { message: "Usuario carregado.", data });
});

const update = asyncHandler(async (req, res) => {
  const data = await service.updateProfile(getCurrentUserId(req), req.validated.body);
  return success(res, { message: "Usuario atualizado com sucesso.", data });
});

module.exports = { profile, update };
