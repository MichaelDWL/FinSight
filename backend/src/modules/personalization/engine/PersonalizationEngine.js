const repository = require("../personalization.repository");
const cache = require("../cache/personalization.cache");
const { resolveStrategy } = require("../strategies");
const {
  DEFAULT_ALLOCATIONS,
  PROFILE_TYPES,
  normalizeAllocation,
  monthStart,
} = require("../constants");
const {
  buildBudgetRules,
  computeUsageByBucket,
  withProgress,
} = require("../services/budget.service");
const { buildHealthScore } = require("../services/healthScore.service");
const { buildRecommendations } = require("../services/recommendation.service");
const {
  buildAlerts,
  buildPersonalizedInsights,
} = require("../services/alert.service");

async function ensureProfile(userId) {
  const existing = await repository.findProfile(userId);
  if (existing) return existing;

  return repository.upsertProfile(userId, {
    profileType: PROFILE_TYPES.EQUILIBRADO,
    incomeSource: null,
    monthlyIncome: 0,
    allocation: DEFAULT_ALLOCATIONS.equilibrado,
    notifications: [],
    onboardingCompleted: false,
  });
}

async function saveProfile(userId, payload) {
  const allocation = normalizeAllocation(
    payload.allocation ||
      DEFAULT_ALLOCATIONS[payload.profileType] ||
      DEFAULT_ALLOCATIONS.equilibrado,
  );

  const profile = await repository.upsertProfile(userId, {
    profileType: payload.profileType || PROFILE_TYPES.EQUILIBRADO,
    incomeSource: payload.incomeSource || null,
    monthlyIncome: Number(payload.monthlyIncome) || 0,
    allocation,
    notifications: payload.notifications || [],
    onboardingCompleted: Boolean(payload.onboardingCompleted),
  });

  const rules = buildBudgetRules({
    monthlyIncome: profile.monthlyIncome,
    allocation: profile.allocation,
  });
  await repository.replaceBudgetRules(userId, rules, monthStart());
  await cache.invalidate(userId);
  return profile;
}

async function rebuildContext(userId, { force = false } = {}) {
  if (!force) {
    const cached = await cache.get(userId, "context");
    if (cached) return cached;
  }

  const profile = await ensureProfile(userId);
  const strategy = resolveStrategy(profile.profileType);
  const referenceMonth = monthStart();
  const snapshot = await repository.getMonthSnapshot(userId, referenceMonth);
  const spending = await repository.getSpendingByCategory(userId, referenceMonth);

  let budgets = await repository.listBudgetRules(userId, referenceMonth);
  if (!budgets.length && profile.monthlyIncome > 0) {
    const rules = buildBudgetRules({
      monthlyIncome: profile.monthlyIncome,
      allocation: profile.allocation,
    });
    budgets = await repository.replaceBudgetRules(userId, rules, referenceMonth);
  }

  const usage = computeUsageByBucket(spending);
  budgets = withProgress(await repository.updateBudgetUsage(userId, usage, referenceMonth));

  const health = buildHealthScore({
    monthlyIncome: profile.monthlyIncome,
    snapshot,
    budgets,
    allocation: profile.allocation,
  });
  await repository.upsertHealthScore(userId, health.score, health);

  const history = await repository.listHealthHistory(userId, { days: 365 });
  const recommendations = buildRecommendations({
    strategy,
    budgets,
    snapshot,
    monthlyIncome: profile.monthlyIncome,
    health,
  });
  const alerts = buildAlerts({
    budgets,
    snapshot,
    notifications: profile.notifications,
    monthlyIncome: profile.monthlyIncome,
  });
  const insights = buildPersonalizedInsights({
    budgets,
    snapshot,
    strategy,
  });

  const context = {
    generatedAt: new Date().toISOString(),
    profile: {
      type: profile.profileType,
      title: strategy.title,
      description: strategy.description,
      incomeSource: profile.incomeSource,
      monthlyIncome: profile.monthlyIncome,
      allocation: profile.allocation,
      notifications: profile.notifications,
      onboardingCompleted: profile.onboardingCompleted,
    },
    strategy: strategy.describe(),
    budgets,
    progress: budgets.map((item) => ({
      key: item.key,
      label: item.label,
      limit: item.limit,
      used: item.used,
      remaining: item.remaining,
      usagePercent: item.usagePercent,
      status: item.status,
      color: item.color,
    })),
    health: {
      score: health.score,
      label: health.label,
      factors: health.factors,
      history: {
        month: history.filter((item) => {
          const d = new Date(item.date);
          const now = new Date();
          return d >= new Date(now.getFullYear(), now.getMonth(), 1);
        }),
        sixMonths: history.slice(-180),
        year: history,
      },
    },
    recommendations,
    alerts,
    insights,
    home: {
      priority: strategy.getHomePriority(),
      spotlight: alerts[0] || recommendations[0] || null,
      hiddenWidgets: strategy.getHiddenWidgets(),
    },
    dashboards: {
      general: { kpiOrder: strategy.getDashboardKpiOrder("general") },
      expenses: { kpiOrder: strategy.getDashboardKpiOrder("expenses") },
      cashflow: { kpiOrder: strategy.getDashboardKpiOrder("cashflow") },
      cards: { kpiOrder: strategy.getDashboardKpiOrder("cards") },
      investments: { kpiOrder: strategy.getDashboardKpiOrder("investments") },
    },
  };

  await cache.set(userId, context, "context");
  return context;
}

async function invalidateAndRebuild(userId) {
  await cache.invalidate(userId);
  return rebuildContext(userId, { force: true });
}

module.exports = {
  ensureProfile,
  saveProfile,
  rebuildContext,
  invalidateAndRebuild,
};
