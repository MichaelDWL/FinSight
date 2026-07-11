const asyncHandler = require("../../utils/asyncHandler");
const { getCurrentUserId } = require("../../utils/demoUser");
const { success } = require("../../utils/apiResponse");
const service = require("./dashboard.service");

const show = asyncHandler(async (req, res) => {
  const data = await service.getDashboard(getCurrentUserId(req));
  return success(res, { message: "Dashboard carregada.", data });
});

module.exports = { show };
