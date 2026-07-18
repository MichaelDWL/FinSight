const AppError = require("../../utils/AppError");
const { invalidateUserAnalytics } = require("../analytics/analytics.invalidation");
const personalization = require("../personalization");
const repository = require("./goals.repository");

function bustCaches(userId, eventName = personalization.EVENTS.CACHE_BUST) {
  invalidateUserAnalytics(userId).catch(() => undefined);
  personalization.notifyMutation(userId, eventName).catch(() => undefined);
}

async function list(userId, options = {}) {
  const result = await repository.findAll(userId, options);
  // BFF / callers legados esperam array
  if (!options.pagination) return result.items;
  return result;
}

async function create(userId, payload) {
  const result = await repository.create(userId, payload);
  bustCaches(userId, personalization.EVENTS.CACHE_BUST);
  return result;
}

async function update(userId, id, payload) {
  const updated = await repository.update(userId, id, payload);
  if (!updated) throw new AppError("Meta nao encontrada.", 404);
  const eventName =
    payload.status === "confirmada" ? personalization.EVENTS.GOAL_COMPLETED : personalization.EVENTS.CACHE_BUST;
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
