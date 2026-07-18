import { app } from "./elements.js";
import { store } from "../store.js";
import { getRoute } from "../router.js";
import { destroyAllCharts } from "../../components/charts/ChartWrapper.js";
import { initCustomSelects } from "../../components/select/customSelect.js";
import { personalizationService } from "../../services/personalization.js";
import { bindProfilePage } from "../../modules/profile/events.js";
import { bindAdminPage } from "../../modules/admin/events.js";
import { setActiveRoute } from "./navigation.js";
import { isAdminUser } from "./userHeader.js";
import { showToast } from "./toast.js";
import {
  isAnalyticsDashboardRoute,
  renderAnalyticsDashboardPage,
} from "./analyticsDashboard.js";
import { loadRouteData } from "./dataLoaders.js";
import { openInvestmentModal } from "./modals.js";
import {
  dashboardView,
  transactionsView,
  wealthView,
  investmentDetailView,
  billsSummaryView,
  accountsView,
  billsView,
  cardsView,
  cardDetailView,
  accountDetailView,
  goalsView,
  profileView,
  adminView,
  renderTransactionsTable,
  renderBillsList,
  mountInvestmentDetailCharts,
} from "./views.js";

export async function reloadAndRender() {
  store.bootstrapReady = false;
  store.loadedRouteKey = null;
  store.dashboardData = null;
  store.analyticsDashboardData = null;
  store.analyticsDashboardPayload = null;
  await renderRoute();
}

export async function renderRoute() {
  const route = getRoute();
  const viewRoute = route === "investimento-novo" ? "patrimonio" : route;
  setActiveRoute(viewRoute);

  if (viewRoute === "admin" && !isAdminUser()) {
    window.location.hash = "#dashboard";
    showToast("Acesso restrito a administradores.");
    return;
  }

  if (isAnalyticsDashboardRoute(viewRoute)) {
    await renderAnalyticsDashboardPage(route);
    return;
  }

  destroyAllCharts();
  app.innerHTML = `
    <section class="app-page">
      <div class="skeleton"></div>
      <div class="skeleton"></div>
    </section>
  `;

  await loadRouteData(route);

  if (viewRoute === "perfil" && !store.personalizationContext) {
    store.personalizationContext = await personalizationService
      .getContext()
      .catch(() => null);
  }

  const views = {
    dashboard: dashboardView,
    transacoes: transactionsView,
    patrimonio: wealthView,
    "investimento-detalhe": investmentDetailView,
    "contas-resumo": billsSummaryView,
    "contas-bancos": accountsView,
    "contas-despesas": billsView,
    "contas-cartoes": cardsView,
    "cartao-detalhe": cardDetailView,
    "conta-detalhe": accountDetailView,
    metas: goalsView,
    perfil: profileView,
    admin: adminView,
  };

  app.innerHTML = views[viewRoute]();

  if (viewRoute === "perfil") {
    bindProfilePage(app, {
      showToast,
      onSaved: async () => {
        store.personalizationContext = await personalizationService
          .getContext()
          .catch(() => store.personalizationContext);
        store.bootstrapReady = false;
        await reloadAndRender();
      },
    });
  }

  if (viewRoute === "admin") {
    bindAdminPage(app, {
      showToast,
      currentUser: store.currentUser,
    });
  }

  if (viewRoute === "investimento-detalhe") {
    mountInvestmentDetailCharts();
  }

  if (viewRoute === "transacoes") renderTransactionsTable();
  if (viewRoute === "contas-despesas") renderBillsList();
  initCustomSelects(app);
  if (route === "investimento-novo") openInvestmentModal();
}
