const eventBus = require("./eventBus");
const engine = require("../engine/PersonalizationEngine");
const { EVENTS } = require("../constants");
const { invalidateUserAnalytics } = require("../../analytics/analytics.invalidation");

let wired = false;

function wirePersonalizationEvents() {
  if (wired) return;
  wired = true;

  const rebuild = async ({ userId }) => {
    if (!userId) return;
    await engine.invalidateAndRebuild(userId);
    invalidateUserAnalytics(userId).catch(() => undefined);
  };

  eventBus.on(EVENTS.TRANSACTION_CREATED, rebuild);
  eventBus.on(EVENTS.TRANSACTION_UPDATED, rebuild);
  eventBus.on(EVENTS.INVESTMENT_ADDED, rebuild);
  eventBus.on(EVENTS.BILL_PAID, rebuild);
  eventBus.on(EVENTS.SALARY_UPDATED, rebuild);
  eventBus.on(EVENTS.PROFILE_UPDATED, rebuild);
  eventBus.on(EVENTS.GOAL_COMPLETED, rebuild);
  eventBus.on(EVENTS.BUDGET_EXCEEDED, rebuild);
  eventBus.on(EVENTS.ONBOARDING_COMPLETED, rebuild);
  eventBus.on(EVENTS.CACHE_BUST, rebuild);
}

module.exports = { wirePersonalizationEvents };
