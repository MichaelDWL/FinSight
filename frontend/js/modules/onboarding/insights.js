import { ALLOCATION_KEYS } from "./constants.js";
import { getOnboardingPrefs, moneyFromPercent } from "./state.js";

/**
 * Gera insights a partir do perfil/orçamento definido no onboarding.
 * Pode ser consumido por dashboards e alertas.
 */
export function buildBudgetInsights({
  spentByCategory = {},
  investedThisMonth = 0,
  emergencyBalance = 0,
  emergencyTarget = 0,
  wealthGrowthPercent = null,
} = {}) {
  const prefs = getOnboardingPrefs();
  if (!prefs) return [];

  const income = Number(prefs.monthlyIncome) || 0;
  const allocation = prefs.allocation || {};
  const insights = [];

  for (const item of ALLOCATION_KEYS) {
    const budget = moneyFromPercent(income, allocation[item.key]);
    if (budget <= 0) continue;
    const spent = Number(spentByCategory[item.key] ?? spentByCategory[item.label] ?? 0);
    if (spent <= 0) continue;
    const usedPct = Math.round((spent / budget) * 100);
    if (usedPct >= 70) {
      insights.push({
        type: usedPct >= 100 ? "warning" : "info",
        message: `Você já utilizou ${usedPct}% do orçamento destinado a ${item.label.toLowerCase()}.`,
      });
    }
  }

  const investBudget = moneyFromPercent(income, allocation.investimentos);
  if (investBudget > 0) {
    const remaining = Math.max(investBudget - Number(investedThisMonth || 0), 0);
    if (remaining > 0) {
      insights.push({
        type: "goal",
        message: `Faltam R$ ${remaining.toLocaleString("pt-BR")} para atingir sua meta de investimentos deste mês.`,
      });
    } else {
      insights.push({
        type: "success",
        message: "Parabéns! Você investiu acima da meta este mês.",
      });
    }
  }

  const foodBudget = moneyFromPercent(income, Math.round((allocation.contas || 0) * 0.25));
  const foodSpent = Number(spentByCategory.Alimentação || spentByCategory.alimentacao || 0);
  if (foodBudget > 0 && foodSpent > 0 && foodSpent < foodBudget) {
    const saved = Math.round(foodBudget - foodSpent);
    insights.push({
      type: "opportunity",
      message: `Você economizou R$ ${saved.toLocaleString("pt-BR")} em alimentação.`,
      action: "Deseja mover essa economia para sua reserva?",
    });
  }

  if (emergencyTarget > 0 && emergencyBalance < emergencyTarget) {
    insights.push({
      type: "warning",
      message: "Reserva de emergência abaixo da meta.",
    });
  }

  if (wealthGrowthPercent != null && Number(wealthGrowthPercent) > 0) {
    insights.push({
      type: "success",
      message: `Seu patrimônio cresceu ${Number(wealthGrowthPercent).toFixed(0)}% nos últimos 3 meses.`,
    });
  }

  return insights;
}

export function getPlanningLimits() {
  const prefs = getOnboardingPrefs();
  if (!prefs) return null;
  const income = Number(prefs.monthlyIncome) || 0;
  const limits = {};
  for (const item of ALLOCATION_KEYS) {
    const percent = Number(prefs.allocation?.[item.key]) || 0;
    limits[item.key] = {
      label: item.label,
      percent,
      amount: moneyFromPercent(income, percent),
      color: item.color,
    };
  }
  return {
    income,
    profileId: prefs.profileId,
    profileTitle: prefs.profileTitle,
    notifications: prefs.notifications || [],
    limits,
  };
}
