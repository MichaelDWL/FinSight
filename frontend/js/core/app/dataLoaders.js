import { store } from "../store.js";
import { bootstrapService } from "../../services/bootstrap.js";
import { usersService } from "../../services/users.js";
import { bffService } from "../../services/bff.js";
import { api } from "../../services/api.js";
import { resolveIcon } from "../../utils/icons.js";
import {
  normalizeTransaction,
  normalizeInvestment,
  normalizeGoal,
  normalizeBill,
} from "../../utils/normalize.js";
import { updateUserHeader } from "./userHeader.js";
import { showToast } from "./toast.js";

export function applyBootstrapData(data = {}) {
  store.accounts = (data.accounts || []).map((account) => ({
    ...account,
    icon: resolveIcon(account.icon, "fa-building-columns"),
  }));
  store.creditCards = data.cards || [];
}

export function applyDashboardData(data = {}) {
  store.dashboardData = data;
  store.transactions = (data.transactions || data.latestTransactions || data.recentTransactions || []).map(
    normalizeTransaction,
  );
  store.investments = (data.investments || data.portfolio || []).map(normalizeInvestment);
  store.accounts = (data.accounts || []).map((account) => ({
    ...account,
    icon: resolveIcon(account.icon, "fa-building-columns"),
  }));
  const cardsList = Array.isArray(data.cards) ? data.cards : data.cards?.list;
  if (cardsList) store.creditCards = cardsList;
  store.bills = (data.bills || data.pendingBills || data.nextBills || []).map(normalizeBill);
  store.goals = (data.goals || []).map(normalizeGoal);
}

/** Mescla o payload secundario da Home sem apagar os dados essenciais ja renderizados. */
export function applyHomeSecondaryData(secondary = {}) {
  const current = store.dashboardData || {};
  const monthlyFlow = secondary.monthlyFlow || secondary.charts?.monthlyFlow || current.monthlyFlow || [];
  const flowSummary = secondary.flowSummary || secondary.charts?.flowSummary || current.flowSummary || {};

  store.dashboardData = {
    ...current,
    ...secondary,
    monthlyFlow,
    flowSummary,
    wealthBreakdown: {
      ...(current.wealthBreakdown || {}),
      ...(secondary.wealthBreakdown || {}),
      ...(secondary.charts?.wealthBreakdown || {}),
    },
    meta: { scope: "full", secondaryPending: false },
  };

  if (Array.isArray(secondary.goals)) {
    store.goals = secondary.goals.map(normalizeGoal);
  }
  if (Array.isArray(secondary.bills) || Array.isArray(secondary.pendingBills) || Array.isArray(secondary.nextBills)) {
    store.bills = (secondary.bills || secondary.pendingBills || secondary.nextBills || []).map(normalizeBill);
  }
}

/** Aplica user/contas/cartoes vindos de qualquer endpoint BFF (1 call por tela). */
export function applyBffShell(data = {}) {
  if (data.user) {
    store.currentUser = data.user;
    updateUserHeader();
  }

  if (Array.isArray(data.accounts)) {
    store.accounts = data.accounts.map((account) => ({
      ...account,
      icon: resolveIcon(account.icon, "fa-building-columns"),
    }));
  }

  const cardsList = Array.isArray(data.cards) ? data.cards : data.cards?.list;
  if (cardsList) store.creditCards = cardsList;

  store.bootstrapReady = true;
}

const BFF_ROUTE_LOADERS = new Set([
  "dashboard",
  "transacoes",
  "contas-resumo",
  "contas-despesas",
  "contas-bancos",
  "contas-cartoes",
  "cartao-detalhe",
  "conta-detalhe",
  "patrimonio",
  "investimento-detalhe",
  "metas",
  "perfil",
]);

const BFF_CACHE_TTL_MS = 60_000;

function bffCacheKey(route) {
  if (["contas-resumo", "contas-despesas", "contas-bancos"].includes(route)) return "accounts";
  if (["patrimonio", "investimento-detalhe"].includes(route)) return "investments";
  if (["metas", "perfil"].includes(route)) return "insights";
  if (route === "contas-cartoes") return "cards";
  if (route === "cartao-detalhe") return `card-detail:${store.selectedCardId || ""}`;
  if (route === "conta-detalhe") return `account-detail:${store.selectedAccountId || ""}`;
  if (route === "dashboard") return "home";
  if (route === "transacoes") return "transactions";
  return route;
}

function getCachedBff(key) {
  const entry = store.bffCache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > BFF_CACHE_TTL_MS * 5) {
    delete store.bffCache[key];
    return null;
  }
  return entry.data;
}

function setCachedBff(key, data) {
  store.bffCache[key] = { data, ts: Date.now() };
}

function isCacheFresh(key) {
  const entry = store.bffCache[key];
  return entry && Date.now() - entry.ts < BFF_CACHE_TTL_MS;
}

function applyAccountsData(data, route) {
  applyBffShell(data);
  if (route === "contas-resumo") {
    store.bills = (data.bills || []).map(normalizeBill);
    store.currentInvoices = data.invoices || [];
  } else if (route === "contas-despesas") {
    store.bills = (data.bills || []).map(normalizeBill);
  }
}

function applyInvestmentsData(data) {
  applyBffShell(data);
  store.investments = (data.portfolio || []).map(normalizeInvestment);
  store.portfolioSummary = data.summary || null;
}

function applyInsightsData(data, route) {
  applyBffShell(data);
  store.goals = (data.goals || []).map(normalizeGoal);
  // metas e perfil compartilham o mesmo payload BFF — personalizacao serve os dois.
  if (data.personalization) {
    store.personalizationContext = data.personalization;
  } else if (route === "perfil") {
    store.personalizationContext = null;
  }
}

function applyRouteData(route, data) {
  if (route === "dashboard") {
    applyBffShell(data);
    applyDashboardData(data);
    const secondaryCached = getCachedBff("home-secondary");
    if (secondaryCached) applyHomeSecondaryData(secondaryCached);
  } else if (route === "transacoes") {
    applyBffShell(data);
    store.transactions = (data.list || []).map(normalizeTransaction);
  } else if (["contas-resumo", "contas-despesas", "contas-bancos"].includes(route)) {
    applyAccountsData(data, route);
  } else if (route === "contas-cartoes") {
    applyBffShell(data);
  } else if (route === "cartao-detalhe") {
    applyBffShell(data);
    store.cardDetailData = data.card || null;
    if (store.cardDetailData?.id) store.selectedCardId = store.cardDetailData.id;
  } else if (route === "conta-detalhe") {
    applyBffShell(data);
    store.accountDetailData = data.account
      ? { ...data.account, icon: resolveIcon(data.account.icon, "fa-building-columns") }
      : null;
    if (store.accountDetailData?.id) store.selectedAccountId = store.accountDetailData.id;
  } else if (["patrimonio", "investimento-detalhe"].includes(route)) {
    applyInvestmentsData(data);
  } else if (["metas", "perfil"].includes(route)) {
    applyInsightsData(data, route);
  }
}

/** Invalida cache SWR em memoria (mutacoes / logout / reload forçado). */
export function invalidateBffCache(keys = null) {
  if (!keys) {
    store.bffCache = {};
    return;
  }
  for (const key of keys) {
    delete store.bffCache[key];
  }
}

async function fetchRouteData(route) {
  if (route === "dashboard") return bffService.getHome();
  if (route === "transacoes") return bffService.getTransactions();
  if (["contas-resumo", "contas-despesas", "contas-bancos"].includes(route)) return bffService.getAccounts();
  if (route === "contas-cartoes") return bffService.getCards();
  if (route === "cartao-detalhe") {
    const id = store.selectedCardId || store.creditCards[0]?.id;
    if (!id) return null;
    return bffService.getCardDetail(id);
  }
  if (route === "conta-detalhe") {
    const id = store.selectedAccountId || store.accounts[0]?.id;
    if (!id) return null;
    return bffService.getAccountDetail(id);
  }
  if (["patrimonio", "investimento-detalhe"].includes(route)) return bffService.getInvestments();
  if (["metas", "perfil"].includes(route)) return bffService.getInsights();
  return null;
}

const ROUTE_DATA_LOADERS = {
  dashboard: () => fetchAndApply("dashboard"),
  transacoes: () => fetchAndApply("transacoes"),
  "contas-resumo": () => fetchAndApply("contas-resumo"),
  "contas-despesas": () => fetchAndApply("contas-despesas"),
  "contas-bancos": () => fetchAndApply("contas-bancos"),
  "contas-cartoes": () => fetchAndApply("contas-cartoes"),
  "cartao-detalhe": () => fetchAndApply("cartao-detalhe"),
  "conta-detalhe": () => fetchAndApply("conta-detalhe"),
  patrimonio: () => fetchAndApply("patrimonio"),
  "investimento-detalhe": () => fetchAndApply("investimento-detalhe"),
  metas: () => fetchAndApply("metas"),
  perfil: () => fetchAndApply("perfil"),
};

const inflightBff = new Map();

async function fetchAndApply(route) {
  const key = bffCacheKey(route);
  if (inflightBff.has(key)) {
    await inflightBff.get(key);
    const cached = getCachedBff(key);
    if (cached) applyRouteData(route, cached);
    return;
  }

  const pending = (async () => {
    const data = await fetchRouteData(route);
    if (data === null) return;
    setCachedBff(key, data);
    applyRouteData(route, data);
  })();

  inflightBff.set(key, pending);
  try {
    await pending;
  } finally {
    inflightBff.delete(key);
  }
}

export async function loadBootstrap({ force = false } = {}) {
  if (store.bootstrapReady && !force) return;
  if (store.isLoadingData) return;

  store.isLoadingData = true;
  try {
    const profilePromise = store.currentUser
      ? Promise.resolve(store.currentUser)
      : usersService.profile();
    const [bootstrap, user] = await Promise.all([
      bootstrapService.getBootstrap(),
      profilePromise,
    ]);
    applyBootstrapData(bootstrap);
    store.currentUser = user;
    store.bootstrapReady = true;
    updateUserHeader();

    // Mutacao explicita (POST): gera recorrencias vencidas sem poluir GETs do BFF.
    api.post("/recurrences/sync").catch(() => undefined);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível carregar os dados da API.");
  } finally {
    store.isLoadingData = false;
  }
}

export function hasCachedData(route) {
  const key = bffCacheKey(route);
  return getCachedBff(key) !== null;
}

export async function loadRouteData(route, { force = false } = {}) {
  const viewRoute = route === "investimento-novo" ? "patrimonio" : route;
  const loader = ROUTE_DATA_LOADERS[viewRoute];

  const routeCacheKey =
    viewRoute === "cartao-detalhe"
      ? `cartao-detalhe:${store.selectedCardId || ""}`
      : viewRoute === "conta-detalhe"
        ? `conta-detalhe:${store.selectedAccountId || ""}`
        : viewRoute;

  if (loader && BFF_ROUTE_LOADERS.has(viewRoute)) {
    if (store.loadedRouteKey === routeCacheKey && !force && store.bootstrapReady) return;

    const cacheKey = bffCacheKey(viewRoute);
    const cached = getCachedBff(cacheKey);

    if (cached && !force) {
      applyRouteData(viewRoute, cached);
      store.loadedRouteKey = routeCacheKey;
      store.bootstrapReady = true;

      if (!isCacheFresh(cacheKey)) {
        fetchAndApply(viewRoute).catch(() => {});
      }
      return;
    }

    await loader();
    store.loadedRouteKey = routeCacheKey;
    return;
  }

  await loadBootstrap({ force });
  if (!loader) return;
  if (store.loadedRouteKey === routeCacheKey && !force) return;
  await loader();
  store.loadedRouteKey = routeCacheKey;
}

/**
 * Carrega dados secundarios da Home em background.
 * Retorna true se o store foi atualizado e a view deve ser re-pintada.
 */
export async function enrichHomeSecondary({ force = false } = {}) {
  const cacheKey = "home-secondary";
  const cached = getCachedBff(cacheKey);
  const alreadyComplete = store.dashboardData?.meta?.secondaryPending === false;

  if (cached && !force) {
    if (!alreadyComplete) {
      applyHomeSecondaryData(cached);
    }
    if (isCacheFresh(cacheKey)) {
      return !alreadyComplete;
    }
  }

  if (inflightBff.has(cacheKey) && !force) {
    await inflightBff.get(cacheKey);
    return Boolean(getCachedBff(cacheKey)) && !alreadyComplete;
  }

  const pending = (async () => {
    const data = await bffService.getHomeSecondary();
    setCachedBff(cacheKey, data);
    applyHomeSecondaryData(data);
  })();

  inflightBff.set(cacheKey, pending);
  try {
    await pending;
    return true;
  } catch (error) {
    console.error(error);
    return Boolean(cached) && !alreadyComplete;
  } finally {
    inflightBff.delete(cacheKey);
  }
}
