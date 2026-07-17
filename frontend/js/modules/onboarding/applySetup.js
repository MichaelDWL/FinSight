import { accountsService } from "../../services/accounts.js";
import { cardsService } from "../../services/cards.js";
import { goalsService } from "../../services/goals.js";
import { movementsService } from "../../services/movements.js";
import { personalizationService } from "../../services/personalization.js";
import {
  ALLOCATION_KEYS,
  DEFAULT_CATEGORIES,
  PROFILES,
} from "./constants.js";
import { moneyFromPercent, saveOnboardingPrefs } from "./state.js";

function deadlineInMonths(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function dueDateForDay(day) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const safeDay = Math.min(Math.max(Number(day) || 1, 1), 28);
  const date = new Date(year, month, safeDay);
  if (date < now) date.setMonth(date.getMonth() + 1);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function normalizeAccountType(type) {
  const allowed = new Set([
    "corrente",
    "poupanca",
    "investimento",
    "carteira",
    "dinheiro",
    "outros",
  ]);
  return allowed.has(type) ? type : "corrente";
}

export async function applyOnboardingSetup(state) {
  const summary = {
    accountsCreated: 0,
    cardsCreated: 0,
    billsCreated: 0,
    goalsCreated: 0,
    categories: [...DEFAULT_CATEGORIES],
    profileTitle: "",
    errors: [],
  };

  const profile = PROFILES.find((item) => item.id === state.profileId) || PROFILES[0];
  summary.profileTitle = profile.title;
  const income = Number(state.monthlyIncome) || 0;
  const createdAccounts = [];

  if (state.wantAccounts && Array.isArray(state.accounts)) {
    for (const account of state.accounts) {
      const name = String(account.name || "").trim();
      if (!name) continue;
      try {
        const created = await accountsService.create({
          name,
          type: normalizeAccountType(account.type),
          institution: String(account.bank || "").trim(),
          color: "#0d6efd",
          icon: "fa-building-columns",
          notes: "Criada no assistente de configuração inicial.",
          balance: Number(account.balance) || 0,
        });
        createdAccounts.push(created);
        summary.accountsCreated += 1;
      } catch (error) {
        summary.errors.push(error.message || "Falha ao criar conta.");
      }
    }
  }

  const fallbackAccountId = createdAccounts[0]?.id || null;

  if (state.wantCards && Array.isArray(state.cards)) {
    for (const card of state.cards) {
      const name = String(card.name || "").trim();
      const limit = Number(card.limit) || 0;
      if (!name || limit <= 0) continue;
      try {
        await cardsService.create({
          name,
          bank: String(card.bank || name).trim() || name,
          brand: "Cartão",
          lastDigits: String(card.lastDigits || "").replace(/\D/g, "").slice(-3),
          color: "#0d6efd",
          closingDay: Number(card.closingDay) || 1,
          dueDay: Number(card.dueDay) || 10,
          totalLimit: limit,
          notes: card.accountId
            ? `Vinculado à conta ${card.accountId}`
            : "Criado no assistente de configuração inicial.",
        });
        summary.cardsCreated += 1;
      } catch (error) {
        summary.errors.push(error.message || "Falha ao criar cartão.");
      }
    }
  }

  if (state.wantBills && Array.isArray(state.bills)) {
    for (const bill of state.bills) {
      const description = String(bill.label || "").trim();
      const value = Number(bill.value) || 0;
      const accountId = bill.accountId || fallbackAccountId;
      if (!description || value <= 0 || !accountId) continue;
      try {
        await movementsService.create({
          tipo: "conta",
          description,
          value,
          date: dueDateForDay(bill.dueDay),
          dueDate: dueDateForDay(bill.dueDay),
          accountId,
          category: bill.category || "Outros",
          payment: bill.payment || "boleto",
          recurring: true,
          notes: `Recorrência ${bill.recurrence || "mensal"} · Onboarding FinSight`,
        });
        summary.billsCreated += 1;
      } catch (error) {
        summary.errors.push(error.message || "Falha ao criar conta recorrente.");
      }
    }
  }

  const goalDefs = [
    {
      key: "investimentos",
      name: "Meta de investimentos",
      months: 1,
    },
    {
      key: "metas",
      name: "Reserva / objetivos",
      months: 3,
    },
    {
      key: "desenvolvimento",
      name: "Desenvolvimento pessoal",
      months: 2,
    },
  ];

  for (const goal of goalDefs) {
    const target = moneyFromPercent(income, state.allocation[goal.key]);
    if (target < 1) continue;
    try {
      await goalsService.create({
        name: goal.name,
        target,
        current: 0,
        deadline: deadlineInMonths(goal.months),
        status: "ativa",
      });
      summary.goalsCreated += 1;
    } catch (error) {
      summary.errors.push(error.message || "Falha ao criar meta.");
    }
  }

  const limits = {};
  for (const item of ALLOCATION_KEYS) {
    limits[item.key] = {
      percent: Number(state.allocation[item.key]) || 0,
      amount: moneyFromPercent(income, state.allocation[item.key]),
    };
  }

  summary.limits = limits;
  summary.dashboards = [
    "Dashboard geral",
    "Dashboard de gastos",
    "Dashboard de cartões",
    "Dashboard de investimentos",
  ];

  try {
    const defaultAllocation = profile.allocation;
    const customized =
      JSON.stringify(state.allocation) !== JSON.stringify(defaultAllocation);

    summary.personalization = await personalizationService.completeOnboarding({
      profileId: customized ? "custom" : state.profileId,
      profileType: customized ? "custom" : state.profileId,
      incomeSource: state.incomeSource || null,
      monthlyIncome: income,
      allocation: state.allocation,
      notifications: state.notifications || [],
      customized,
      syncGoals: false,
    });
  } catch (error) {
    summary.errors.push(
      error.message || "Falha ao sincronizar personalização no servidor.",
    );
  }

  saveOnboardingPrefs(state, summary);
  return summary;
}
