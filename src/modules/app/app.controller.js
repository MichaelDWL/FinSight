const asyncHandler = require("../../utils/asyncHandler");
const { getCurrentUserId } = require("../../utils/demoUser");
const { success } = require("../../utils/apiResponse");
const service = require("./app.service");

const bootstrap = asyncHandler(async (req, res) => {
  const data = await service.getBootstrap(getCurrentUserId(req));
  return success(res, { message: "Bootstrap carregado.", data });
});

module.exports = { bootstrap };
