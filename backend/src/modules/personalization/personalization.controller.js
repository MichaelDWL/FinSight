const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const { getCurrentUserId } = require("../../utils/demoUser");
const service = require("./personalization.service");

const getContext = asyncHandler(async (req, res) => {
  const data = await service.getContext(getCurrentUserId(req));
  return success(res, { message: "Contexto de personalizacao carregado.", data });
});

const getProfile = asyncHandler(async (req, res) => {
  const data = await service.getProfile(getCurrentUserId(req));
  return success(res, { message: "Perfil financeiro carregado.", data });
});

const updateProfile = asyncHandler(async (req, res) => {
  const data = await service.updateProfile(getCurrentUserId(req), req.validated.body);
  return success(res, { message: "Personalizacao atualizada.", data });
});

const completeOnboarding = asyncHandler(async (req, res) => {
  const data = await service.completeOnboarding(
    getCurrentUserId(req),
    req.validated.body,
  );
  return success(res, {
    statusCode: 201,
    message: "Onboarding sincronizado com o Personalization Engine.",
    data,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const data = await service.handleDomainEvent(service.EVENTS.CACHE_BUST, {
    userId: getCurrentUserId(req),
  });
  return success(res, { message: "Contexto recalculado.", data });
});

module.exports = {
  getContext,
  getProfile,
  updateProfile,
  completeOnboarding,
  refresh,
};
