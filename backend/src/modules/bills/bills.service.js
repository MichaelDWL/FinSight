const AppError = require("../../utils/AppError");
const repository = require("./bills.repository");

async function list(userId) {
  return repository.findAll(userId);
}

async function create(userId, payload) {
  return repository.create(userId, payload);
}

async function update(userId, id, payload) {
  const updated = await repository.update(userId, id, payload);
  if (!updated) throw new AppError("Conta nao encontrada.", 404);
  return updated;
}

async function markPaid(userId, id, paid) {
  const updated = await repository.markPaid(userId, id, paid);
  if (!updated) throw new AppError("Conta nao encontrada.", 404);
  return updated;
}

async function remove(userId, id) {
  const removed = await repository.remove(userId, id);
  if (!removed) throw new AppError("Conta nao encontrada.", 404);
  return { id };
}

module.exports = { create, list, markPaid, remove, update };
