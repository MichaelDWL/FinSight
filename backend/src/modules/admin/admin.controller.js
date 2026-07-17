const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const { writeAudit } = require("../auth/audit.service");
const { AUDIT_ACTIONS } = require("../auth/constants");
const service = require("./admin.service");

const listUsers = asyncHandler(async (req, res) => {
  await writeAudit(req, {
    userId: null,
    actorId: req.user.id,
    action: AUDIT_ACTIONS.ADMIN_ACCESS,
    metadata: { resource: "users.list" },
  });
  const data = await service.listUsers(req.validated.query);
  return success(res, { message: "Usuarios listados.", data });
});

const getUser = asyncHandler(async (req, res) => {
  const data = await service.getUser(req.validated.params.userId);
  return success(res, { message: "Usuario carregado.", data });
});

const updateUser = asyncHandler(async (req, res) => {
  const data = await service.updateUser(
    req.user,
    req.validated.params.userId,
    req.validated.body,
    req
  );
  return success(res, { message: "Usuario atualizado.", data });
});

const changeRole = asyncHandler(async (req, res) => {
  const data = await service.changeRole(
    req.user,
    req.validated.params.userId,
    req.validated.body.role,
    req
  );
  return success(res, { message: "Papel atualizado.", data });
});

const suspendUser = asyncHandler(async (req, res) => {
  const data = await service.suspendUser(
    req.user,
    req.validated.params.userId,
    req.validated.body,
    req
  );
  return success(res, { message: "Conta suspensa.", data });
});

const reactivateUser = asyncHandler(async (req, res) => {
  const data = await service.reactivateUser(req.user, req.validated.params.userId, req);
  return success(res, { message: "Conta reativada.", data });
});

const forceLogout = asyncHandler(async (req, res) => {
  await service.forceLogout(req.user, req.validated.params.userId, req);
  return success(res, { message: "Sessoes encerradas." });
});

const resetPassword = asyncHandler(async (req, res) => {
  await service.adminResetPassword(req.user, req.validated.params.userId, req);
  return success(res, { message: "Processo de redefinicao de senha iniciado." });
});

const deleteUser = asyncHandler(async (req, res) => {
  await service.deleteUser(req.user, req.validated.params.userId, req);
  return success(res, { message: "Conta excluida permanentemente." });
});

const userAuditLogs = asyncHandler(async (req, res) => {
  const data = await service.getUserAuditLogs(
    req.validated.params.userId,
    req.validated.query || req.query
  );
  return success(res, { message: "Logs de acesso.", data });
});

const listAuditLogs = asyncHandler(async (req, res) => {
  const data = await service.listAuditLogs(req.validated.query);
  return success(res, { message: "Logs de auditoria.", data });
});

module.exports = {
  listUsers,
  getUser,
  updateUser,
  changeRole,
  suspendUser,
  reactivateUser,
  forceLogout,
  resetPassword,
  deleteUser,
  userAuditLogs,
  listAuditLogs,
};
