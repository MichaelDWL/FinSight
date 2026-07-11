const AppError = require("../../utils/AppError");
const repository = require("./cards.repository");

async function list(userId) {
  return repository.findAll(userId);
}

async function detail(userId, id) {
  const card = await repository.findById(userId, id);
  if (!card) throw new AppError("Cartao nao encontrado.", 404);
  return card;
}

async function create(userId, payload) {
  return repository.create(userId, payload);
}

async function update(userId, id, payload) {
  const updated = await repository.update(userId, id, payload);
  if (!updated) throw new AppError("Cartao nao encontrado.", 404);
  return updated;
}

async function remove(userId, id) {
  const removed = await repository.remove(userId, id);
  if (!removed) throw new AppError("Cartao nao encontrado.", 404);
  return { id };
}

module.exports = { create, detail, list, remove, update };
