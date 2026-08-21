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
const { memoize } = require("../../bff/utils/requestContext");

const inflightRebuilds = new Map();
const inflightReads = new Map();

function defaultProfile() {
  return {
    id: null,
    userId: null,
    profileType: PROFILE_TYPES.EQUILIBRADO,
    incomeSource: null,
    monthlyIncome: 0,
    allocation: DEFAULT_ALLOCATIONS.equilibrado,
    notifications: [],
    onboardingCompleted: false,
    updatedAt: null,
  };
}

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

/** Perfil para leitura: nunca cria linha se nao existir. */
async function loadProfileForRead(userId) {
  const existing = await repository.findProfile(userId);
  return existing || defaultProfile();
}

/**
 * Aplica usage em memoria (sem UPDATE em regras_orcamento).
 */
function applyUsageInMemory(budgets, usageByKey = {}) {
  return withProgress(
    budgets.map((rule) => ({
      ...rule,
      used: Number(usageByKey[rule.key] ?? rule.used) || 0,
    })),
  );
}

function assembleContext({
  profile,
  strategy,
  budgets,
  health,
  history,
  recommendations,
  alerts,
  insights,
}) {
  return {
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
}

/**
 * Calcula o contexto a partir de dados ja carregados (puro, sem I/O).
 */
function computeContextPayload(profile, snapshot, spending, budgets, history) {
  const strategy = resolveStrategy(profile.profileType);
  const usage = computeUsageByBucket(spending);
  const budgetsWithProgress = applyUsageInMemory(budgets, usage);

  const health = buildHealthScore({
    monthlyIncome: profile.monthlyIncome,
    snapshot,
    budgets: budgetsWithProgress,
    allocation: profile.allocation,
  });

  const recommendations = buildRecommendations({
    strategy,
    budgets: budgetsWithProgress,
    snapshot,
    monthlyIncome: profile.monthlyIncome,
    health,
  });
  const alerts = buildAlerts({
    budgets: budgetsWithProgress,
    snapshot,
    notifications: profile.notifications,
    monthlyIncome: profile.monthlyIncome,
  });
  const insights = buildPersonalizedInsights({
    budgets: budgetsWithProgress,
    snapshot,
    strategy,
  });

  return {
    strategy,
    budgets: budgetsWithProgress,
    health,
    recommendations,
    alerts,
    insights,
    context: assembleContext({
      profile,
      strategy,
      budgets: budgetsWithProgress,
      health,
      history,
      recommendations,
      alerts,
      insights,
    }),
  };
}

/**
 * Carrega budgets para leitura: usa regras persistidas ou calcula em memoria.
 * Nunca faz DELETE/INSERT em regras_orcamento.
 */
async function loadBudgetsForReadSafe(userId, profile, referenceMonth) {
  let budgets = [];
  if (userId) {
    budgets = await repository.listBudgetRules(userId, referenceMonth);
  }
  if (!budgets.length && profile.monthlyIncome > 0) {
    budgets = buildBudgetRules({
      monthlyIncome: profile.monthlyIncome,
      allocation: profile.allocation,
    });
  }
  return budgets;
}

/**
 * readContext — SOMENTE SELECT + calculo em memoria.
 * Seguro para GET. Nao faz INSERT/UPDATE/UPSERT/DELETE.
 */
async function readContext(userId, { force = false, historyDays = 365 } = {}) {
  if (!force) {
    const cached = await cache.get(userId, "context");
    if (cached) return cached;
  }

  const historyKey = historyDays > 0 ? `h${historyDays}` : "h0";
  return memoize(`personalization:read:${userId}:${force ? "force" : "normal"}:${historyKey}`, () => {
    const inflightKey = `read:${userId}:${historyKey}`;
    if (inflightReads.has(inflightKey)) {
      return inflightReads.get(inflightKey);
    }

    const readPromise = (async () => {
      const profile = await loadProfileForRead(userId);
      const referenceMonth = monthStart();
      const historyPromise =
        historyDays > 0
          ? repository.listHealthHistory(userId, { days: historyDays })
          : Promise.resolve([]);
      const [snapshot, spending, history] = await Promise.all([
        repository.getMonthSnapshot(userId, referenceMonth),
        repository.getSpendingByCategory(userId, referenceMonth),
        historyPromise,
      ]);

      const budgets = await loadBudgetsForReadSafe(userId, profile, referenceMonth);
      const { context } = computeContextPayload(
        { ...profile, userId },
        snapshot,
        spending,
        budgets,
        history,
      );

      // So cacheia o contexto completo (com historico) para nao servir versao truncada.
      if (historyDays > 0) {
        await cache.set(userId, context, "context");
      }
      return context;
    })();

    inflightReads.set(inflightKey, readPromise);
    return readPromise.finally(() => {
      inflightReads.delete(inflightKey);
    });
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

/**
 * rebuildContext — pode persistir (perfil, orcamentos, saude).
 * Usar somente em mutacoes / sync explicito — nao em GET.
 */
async function rebuildContext(userId, { force = false } = {}) {
  if (!force) {
    const cached = await cache.get(userId, "context");
    if (cached) return cached;
  }

  const inflightKey = `${userId}:${force ? "force" : "normal"}`;
  if (inflightRebuilds.has(inflightKey)) {
    return inflightRebuilds.get(inflightKey);
  }

  const rebuildPromise = (async () => {
    const profile = await ensureProfile(userId);
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
    const strategy = resolveStrategy(profile.profileType);
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

    const context = assembleContext({
      profile,
      strategy,
      budgets,
      health,
      history,
      recommendations,
      alerts,
      insights,
    });

    await cache.set(userId, context, "context");
    return context;
  })();

  inflightRebuilds.set(inflightKey, rebuildPromise);

  try {
    return await rebuildPromise;
  } finally {
    inflightRebuilds.delete(inflightKey);
  }
}

async function invalidateAndRebuild(userId) {
  await cache.invalidate(userId);
  return rebuildContext(userId, { force: true });
}

module.exports = {
  ensureProfile,
  saveProfile,
  readContext,
  rebuildContext,
  invalidateAndRebuild,
  defaultProfile,
  applyUsageInMemory,
  computeContextPayload,
};
