const engine = require("./engine/PersonalizationEngine");
const eventBus = require("./events/eventBus");
const { EVENTS, DEFAULT_ALLOCATIONS, PROFILE_TYPES } = require("./constants");
const { invalidateUserAnalytics } = require("../analytics/analytics.invalidation");
const goalsService = require("../goals/goals.service");

function deadlineInMonths(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

async function getContext(userId) {
  return engine.rebuildContext(userId);
}

async function getProfile(userId) {
  const context = await engine.rebuildContext(userId);
  return context.profile;
}

async function updateProfile(userId, payload) {
  const profile = await engine.saveProfile(userId, {
    ...payload,
    onboardingCompleted: payload.onboardingCompleted ?? true,
  });

  await eventBus.emit(EVENTS.PROFILE_UPDATED, { userId, profile });
  if (payload.monthlyIncome != null) {
    await eventBus.emit(EVENTS.SALARY_UPDATED, {
      userId,
      monthlyIncome: payload.monthlyIncome,
    });
  }

  invalidateUserAnalytics(userId).catch(() => undefined);
  return engine.rebuildContext(userId, { force: true });
}

async function completeOnboarding(userId, payload) {
  const profileType = payload.profileId || payload.profileType || PROFILE_TYPES.EQUILIBRADO;
  const allocation =
    payload.allocation ||
    DEFAULT_ALLOCATIONS[profileType] ||
    DEFAULT_ALLOCATIONS.equilibrado;

  await engine.saveProfile(userId, {
    profileType: payload.customized ? PROFILE_TYPES.CUSTOM : profileType,
    incomeSource: payload.incomeSource || null,
    monthlyIncome: Number(payload.monthlyIncome) || 0,
    allocation,
    notifications: payload.notifications || [],
    onboardingCompleted: true,
  });

  const income = Number(payload.monthlyIncome) || 0;
  if (income > 0 && payload.syncGoals !== false) {
    const goalDefs = [
      { key: "investimentos", name: "Meta de investimentos", months: 1 },
      { key: "metas", name: "Reserva / objetivos", months: 3 },
      { key: "desenvolvimento", name: "Desenvolvimento pessoal", months: 2 },
    ];

    for (const goal of goalDefs) {
      const percent = Number(allocation[goal.key]) || 0;
      const target = Math.round((income * percent) / 100);
      if (target < 1) continue;
      try {
        await goalsService.create(userId, {
          name: goal.name,
          target,
          current: 0,
          deadline: deadlineInMonths(goal.months),
          status: "ativa",
        });
      } catch {
        // metas podem já existir; não bloqueia o onboarding
      }
    }
  }

  await eventBus.emit(EVENTS.ONBOARDING_COMPLETED, { userId });
  invalidateUserAnalytics(userId).catch(() => undefined);
  return engine.rebuildContext(userId, { force: true });
}

async function handleDomainEvent(eventName, payload = {}) {
  const userId = payload.userId;
  if (!userId) return null;
  await eventBus.emit(eventName, payload);
  return engine.invalidateAndRebuild(userId);
}

function notifyMutation(userId, eventName = EVENTS.CACHE_BUST, extra = {}) {
  if (!userId) return Promise.resolve(null);
  return handleDomainEvent(eventName, { userId, ...extra }).catch(() => null);
}

module.exports = {
  getContext,
  getProfile,
  updateProfile,
  completeOnboarding,
  handleDomainEvent,
  notifyMutation,
  EVENTS,
};
