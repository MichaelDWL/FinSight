const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const { getCurrentUserId } = require("../../utils/demoUser");
const service = require("./privacy.service");

const getPolicy = asyncHandler(async (_req, res) => {
  const data = await service.getPrivacyPolicy();
  return success(res, { message: "Politica de privacidade.", data });
});

const consent = asyncHandler(async (req, res) => {
  const data = await service.recordConsent(
    getCurrentUserId(req),
    req.validated.body,
    req
  );
  return success(res, { statusCode: 201, message: "Consentimento registrado.", data });
});

const listConsents = asyncHandler(async (req, res) => {
  const data = await service.listConsents(getCurrentUserId(req));
  return success(res, { message: "Consentimentos.", data });
});

const exportData = asyncHandler(async (req, res) => {
  const data = await service.exportUserData(getCurrentUserId(req));
  res.setHeader("Content-Disposition", "attachment; filename=finsight-export.json");
  return success(res, { message: "Exportacao LGPD.", data });
});

const deleteAccount = asyncHandler(async (req, res) => {
  const data = await service.deleteAccount(getCurrentUserId(req), req);
  return success(res, { message: "Conta anonimizada e desativada.", data });
});

module.exports = { getPolicy, consent, listConsents, exportData, deleteAccount };
