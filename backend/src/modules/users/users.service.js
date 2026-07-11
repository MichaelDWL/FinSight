const AppError = require("../../utils/AppError");
const repository = require("./users.repository");

async function getProfile(userId) {
  const user = await repository.findDemo(userId);
  if (!user) throw new AppError("Usuario nao encontrado.", 404);
  return user;
}

async function updateProfile(userId, payload) {
  const user = await repository.update(userId, payload);
  if (!user) throw new AppError("Usuario nao encontrado.", 404);
  return user;
}

module.exports = { getProfile, updateProfile };
