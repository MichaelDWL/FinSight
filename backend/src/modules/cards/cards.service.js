const AppError = require("../../utils/AppError");
const { invalidateUserAnalytics } = require("../analytics/analytics.invalidation");
const personalization = require("../personalization");
const repository = require("./cards.repository");

function bustCaches(userId) {
  invalidateUserAnalytics(userId).catch(() => undefined);
  personalization.notifyMutation(userId, personalization.EVENTS.CACHE_BUST).catch(() => undefined);
}

async function list(userId) {
  return repository.findAll(userId);
}

async function detail(userId, id) {
  const card = await repository.findById(userId, id);
  if (!card) throw new AppError("Cartao nao encontrado.", 404);
  return card;
}

async function create(userId, payload) {
  const result = await repository.create(userId, payload);
  bustCaches(userId);
  return result;
}

async function update(userId, id, payload) {
  const updated = await repository.update(userId, id, payload);
  if (!updated) throw new AppError("Cartao nao encontrado.", 404);
  bustCaches(userId);
  return updated;
}

async function remove(userId, id) {
  const removed = await repository.remove(userId, id);
  if (!removed) throw new AppError("Cartao nao encontrado.", 404);
  bustCaches(userId);
  return { id };
}

module.exports = { create, detail, list, remove, update };
