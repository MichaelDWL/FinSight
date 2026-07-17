import {
  STORAGE_KEY,
  PREFS_KEY,
  createInitialState,
  PROFILES,
  STEP_IDS,
} from "./constants.js";

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadPersistedState() {
  const saved = safeParse(localStorage.getItem(STORAGE_KEY));
  if (!saved || typeof saved !== "object") return null;
  return {
    ...createInitialState(),
    ...saved,
    allocation: {
      ...createInitialState().allocation,
      ...(saved.allocation || {}),
    },
  };
}

export function persistState(state) {
  const payload = {
    stepIndex: state.stepIndex,
    incomeSource: state.incomeSource,
    monthlyIncome: state.monthlyIncome,
    wantAccounts: state.wantAccounts,
    accounts: state.accounts,
    wantCards: state.wantCards,
    cards: state.cards,
    wantBills: state.wantBills,
    bills: state.bills,
    profileId: state.profileId,
    allocation: state.allocation,
    notifications: state.notifications,
    completed: state.completed,
    skipped: state.skipped,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearPersistedProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

export function markOnboardingDone({ skipped = false } = {}) {
  const payload = {
    ...createInitialState(),
    completed: !skipped,
    skipped,
    stepIndex: STEP_IDS.length - 1,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function isOnboardingPending() {
  const saved = loadPersistedState();
  if (!saved) return true;
  return !saved.completed && !saved.skipped;
}

export function saveOnboardingPrefs(state, summary = {}) {
  const profile = PROFILES.find((item) => item.id === state.profileId) || PROFILES[0];
  const prefs = {
    incomeSource: state.incomeSource,
    monthlyIncome: Number(state.monthlyIncome) || 0,
    profileId: state.profileId,
    profileTitle: profile.title,
    allocation: { ...state.allocation },
    notifications: [...state.notifications],
    categories: summary.categories || [],
    goalsCreated: summary.goalsCreated || 0,
    accountsCreated: summary.accountsCreated || 0,
    cardsCreated: summary.cardsCreated || 0,
    billsCreated: summary.billsCreated || 0,
    completedAt: new Date().toISOString(),
  };
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  return prefs;
}

export function getOnboardingPrefs() {
  return safeParse(localStorage.getItem(PREFS_KEY));
}

/** Redistribui os demais percentuais para a soma permanecer 100%. */
export function setAllocationPercent(allocation, key, rawValue) {
  const keys = Object.keys(allocation);
  if (!keys.includes(key)) return { ...allocation };

  const target = Math.round(Math.max(0, Math.min(100, Number(rawValue) || 0)));
  const others = keys.filter((item) => item !== key);
  const othersSum = others.reduce((sum, item) => sum + Number(allocation[item] || 0), 0);
  let remaining = 100 - target;
  const next = { ...allocation, [key]: target };

  if (!others.length) {
    next[key] = 100;
    return next;
  }

  if (othersSum <= 0) {
    const base = Math.floor(remaining / others.length);
    let leftover = remaining - base * others.length;
    others.forEach((item) => {
      next[item] = base + (leftover > 0 ? 1 : 0);
      if (leftover > 0) leftover -= 1;
    });
    return next;
  }

  let distributed = 0;
  others.forEach((item, index) => {
    if (index === others.length - 1) {
      next[item] = Math.max(0, remaining - distributed);
      return;
    }
    const share = Math.round((Number(allocation[item]) / othersSum) * remaining);
    next[item] = Math.max(0, share);
    distributed += next[item];
  });

  const total = keys.reduce((sum, item) => sum + next[item], 0);
  if (total !== 100) {
    const adjustKey = others[others.length - 1];
    next[adjustKey] = Math.max(0, next[adjustKey] + (100 - total));
  }

  return next;
}

export function allocationSum(allocation) {
  return Object.values(allocation || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

export function moneyFromPercent(income, percent) {
  return Math.round(((Number(income) || 0) * (Number(percent) || 0)) / 100);
}
