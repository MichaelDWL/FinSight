const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const { setAuthCookies, clearAuthCookies } = require("../../utils/cookies");
const service = require("./auth.service");

function attachSessionCookies(res, session) {
  setAuthCookies(res, {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    csrfToken: session.csrfToken,
  });
}

const register = asyncHandler(async (req, res) => {
  const session = await service.register(req.validated.body, req);
  attachSessionCookies(res, session);
  return success(res, {
    statusCode: 201,
    message: "Conta criada com sucesso.",
    data: { user: session.user },
  });
});

const login = asyncHandler(async (req, res) => {
  const session = await service.login(req.validated.body, req);
  attachSessionCookies(res, session);
  return success(res, {
    message: "Login realizado com sucesso.",
    data: { user: session.user },
  });
});

const refresh = asyncHandler(async (req, res) => {
  const session = await service.refresh(req);
  attachSessionCookies(res, session);
  return success(res, {
    message: "Sessao renovada.",
    data: { user: session.user },
  });
});

const logout = asyncHandler(async (req, res) => {
  await service.logout(req);
  clearAuthCookies(res);
  return success(res, { message: "Logout realizado com sucesso." });
});

const me = asyncHandler(async (req, res) => {
  const user = await service.getMe(req.user.id);
  return success(res, { message: "Usuario autenticado.", data: user });
});

const forgotPassword = asyncHandler(async (req, res) => {
  await service.requestPasswordReset(req.validated.body.email, req);
  return success(res, {
    message: "Se o email existir, enviaremos instrucoes de recuperacao.",
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  await service.resetPassword(req.validated.body, req);
  clearAuthCookies(res);
  return success(res, { message: "Senha redefinida com sucesso." });
});

const verifyEmail = asyncHandler(async (req, res) => {
  await service.verifyEmail(req.validated.body.token, req);
  return success(res, { message: "Email verificado com sucesso." });
});

const changePassword = asyncHandler(async (req, res) => {
  await service.changePassword(req.user.id, req.validated.body, req);
  return success(res, { message: "Senha alterada com sucesso." });
});

const listSessions = asyncHandler(async (req, res) => {
  const data = await service.listSessions(req.user.id);
  return success(res, { message: "Sessoes carregadas.", data });
});

const revokeSession = asyncHandler(async (req, res) => {
  await service.revokeSession(req.user.id, req.validated.params.sessionId, req);
  return success(res, { message: "Sessao encerrada." });
});

const revokeAllSessions = asyncHandler(async (req, res) => {
  await service.revokeAllSessions(req.user.id, req);
  clearAuthCookies(res);
  return success(res, { message: "Todas as sessoes foram encerradas." });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  forgotPassword,
  resetPassword,
  verifyEmail,
  changePassword,
  listSessions,
  revokeSession,
  revokeAllSessions,
};
