import { store } from "../store.js";
import { bootstrapService } from "../../services/bootstrap.js";
import { usersService } from "../../services/users.js";
import { bffService } from "../../services/bff.js";
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

const ROUTE_DATA_LOADERS = {
  dashboard: async () => {
    const data = await bffService.getHome();
    applyBffShell(data);
    applyDashboardData(data);
  },
  transacoes: async () => {
    const data = await bffService.getTransactions();
    applyBffShell(data);
    store.transactions = (data.list || []).map(normalizeTransaction);
  },
  "contas-resumo": async () => {
    const data = await bffService.getAccounts();
    applyBffShell(data);
    store.bills = (data.bills || []).map(normalizeBill);
    store.currentInvoices = data.invoices || [];
  },
  "contas-despesas": async () => {
    const data = await bffService.getAccounts();
    applyBffShell(data);
    store.bills = (data.bills || []).map(normalizeBill);
  },
  "contas-bancos": async () => {
    const data = await bffService.getAccounts();
    applyBffShell(data);
  },
  "contas-cartoes": async () => {
    const data = await bffService.getCards();
    applyBffShell(data);
  },
  "cartao-detalhe": async () => {
    const id = store.selectedCardId || store.creditCards[0]?.id;
    if (!id) {
      store.cardDetailData = null;
      return;
    }
    const data = await bffService.getCardDetail(id);
    applyBffShell(data);
    store.cardDetailData = data.card || null;
    if (store.cardDetailData?.id) store.selectedCardId = store.cardDetailData.id;
  },
  "conta-detalhe": async () => {
    const id = store.selectedAccountId || store.accounts[0]?.id;
    if (!id) {
      store.accountDetailData = null;
      return;
    }
    const data = await bffService.getAccountDetail(id);
    applyBffShell(data);
    store.accountDetailData = data.account
      ? {
          ...data.account,
          icon: resolveIcon(data.account.icon, "fa-building-columns"),
        }
      : null;
    if (store.accountDetailData?.id) store.selectedAccountId = store.accountDetailData.id;
  },
  patrimonio: async () => {
    const data = await bffService.getInvestments();
    applyBffShell(data);
    store.investments = (data.portfolio || []).map(normalizeInvestment);
    store.portfolioSummary = data.summary || null;
  },
  "investimento-detalhe": async () => {
    const data = await bffService.getInvestments();
    applyBffShell(data);
    store.investments = (data.portfolio || []).map(normalizeInvestment);
    store.portfolioSummary = data.summary || null;
  },
  metas: async () => {
    const data = await bffService.getInsights();
    applyBffShell(data);
    store.goals = (data.goals || []).map(normalizeGoal);
  },
  perfil: async () => {
    const data = await bffService.getInsights();
    applyBffShell(data);
    store.personalizationContext = data.personalization || null;
    store.goals = (data.goals || []).map(normalizeGoal);
  },
};

export async function loadBootstrap({ force = false } = {}) {
  if (store.bootstrapReady && !force) return;
  if (store.isLoadingData) return;

  store.isLoadingData = true;
  try {
    const [bootstrap, user] = await Promise.all([
      bootstrapService.getBootstrap(),
      usersService.profile(),
    ]);
    applyBootstrapData(bootstrap);
    store.currentUser = user;
    store.bootstrapReady = true;
    updateUserHeader();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível carregar os dados da API.");
  } finally {
    store.isLoadingData = false;
  }
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

  // Telas BFF: uma unica chamada HTTP (sem bootstrap separado)
  if (loader && BFF_ROUTE_LOADERS.has(viewRoute)) {
    if (store.loadedRouteKey === routeCacheKey && !force && store.bootstrapReady) return;
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
