const AppError = require("../../utils/AppError");
const { invalidateUserAnalytics } = require("../analytics/analytics.invalidation");
const { notifyMutation, EVENTS } = require("../personalization");
const repository = require("./goals.repository");

function bustCaches(userId, eventName = EVENTS.CACHE_BUST) {
  invalidateUserAnalytics(userId).catch(() => undefined);
  notifyMutation(userId, eventName).catch(() => undefined);
}

async function list(userId) {
  return repository.findAll(userId);
}

async function create(userId, payload) {
  const result = await repository.create(userId, payload);
  bustCaches(userId, EVENTS.CACHE_BUST);
  return result;
}

async function update(userId, id, payload) {
  const updated = await repository.update(userId, id, payload);
  if (!updated) throw new AppError("Meta nao encontrada.", 404);
  const eventName =
    payload.status === "confirmada" ? EVENTS.GOAL_COMPLETED : EVENTS.CACHE_BUST;
  bustCaches(userId, eventName);
  return updated;
}

async function remove(userId, id) {
  const removed = await repository.remove(userId, id);
  if (!removed) throw new AppError("Meta nao encontrada.", 404);
  bustCaches(userId);
  return { id };
}

module.exports = { create, list, remove, update };
