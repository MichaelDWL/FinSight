import { app } from "./elements.js";
import { store } from "../store.js";
import { bffService } from "../../services/bff.js";
import { destroyAllCharts } from "../../components/charts/ChartWrapper.js";
import { renderDashboardSkeleton } from "../../modules/dashboard/shared/DashboardSkeleton.js";
import {
  mountGeneralDashboardCharts,
  renderGeneralDashboard,
} from "../../modules/dashboard/general/render.js";
import {
  mountExpensesDashboardCharts,
  renderExpensesDashboard,
} from "../../modules/dashboard/expenses/render.js";
import {
  mountCashflowDashboardCharts,
  renderCashflowDashboard,
} from "../../modules/dashboard/cashflow/render.js";
import {
  mountCardsDashboardCharts,
  renderCardsDashboard,
} from "../../modules/dashboard/cards/render.js";
import {
  mountInvestmentsDashboardCharts,
  renderInvestmentsDashboard,
} from "../../modules/dashboard/investments/render.js";
import { normalizeDashboardRoute } from "../../modules/dashboard/shared/periodLabels.js";
import { initDashboardScrollHints } from "../../modules/dashboard/shared/DashboardNav.js";
import { getRoute } from "../router.js";
import { getUserFirstName } from "./userHeader.js";
import { showToast } from "./toast.js";
import { applyBffShell } from "./dataLoaders.js";

const ANALYTICS_DASHBOARD_ROUTES = new Set([
  "dashboards",
  "dashboards/geral",
  "dashboards/gastos",
  "dashboards/fluxo-caixa",
  "dashboards/cartoes",
  "dashboards/investimentos",
]);

const DASHBOARD_RENDERERS = {
  "dashboards/geral": {
    render: renderGeneralDashboard,
    mount: mountGeneralDashboardCharts,
    section: "general",
    getProps: () => ({ firstName: getUserFirstName() }),
  },
  "dashboards/gastos": {
    render: renderExpensesDashboard,
    mount: mountExpensesDashboardCharts,
    section: "expenses",
    getProps: () => ({}),
  },
  "dashboards/fluxo-caixa": {
    render: renderCashflowDashboard,
    mount: mountCashflowDashboardCharts,
    section: "cashflow",
    getProps: () => ({}),
  },
  "dashboards/cartoes": {
    render: renderCardsDashboard,
    mount: mountCardsDashboardCharts,
    section: "cards",
    getProps: () => ({}),
  },
  "dashboards/investimentos": {
    render: renderInvestmentsDashboard,
    mount: mountInvestmentsDashboardCharts,
    section: "investments",
    getProps: () => ({}),
  },
};

export function isAnalyticsDashboardRoute(route) {
  return ANALYTICS_DASHBOARD_ROUTES.has(route);
}

function pickAnalyticsSection(payload, section) {
  if (!payload) return null;
  return payload.sections?.[section] || null;
}

export async function loadAnalyticsDashboard(route = store.currentAnalyticsRoute, period = store.currentDashboardPeriod) {
  const normalizedRoute = normalizeDashboardRoute(route);
  const renderer = DASHBOARD_RENDERERS[normalizedRoute];
  if (!renderer) return null;

  if (store.isLoadingAnalyticsDashboard) return store.analyticsDashboardData;

  store.isLoadingAnalyticsDashboard = true;
  try {
    // Uma unica chamada BFF para todos os paineis do dashboard
    if (
      !store.analyticsDashboardPayload ||
      store.currentDashboardPeriod !== period
    ) {
      store.analyticsDashboardPayload = await bffService.getDashboard({ period });
      applyBffShell(store.analyticsDashboardPayload);
    }

    store.analyticsDashboardData = pickAnalyticsSection(
      store.analyticsDashboardPayload,
      renderer.section,
    );
    store.currentDashboardPeriod = period;
    store.currentAnalyticsRoute = normalizedRoute;
    return store.analyticsDashboardData;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    store.isLoadingAnalyticsDashboard = false;
  }
}

function renderAnalyticsDashboardView(route, data) {
  const normalizedRoute = normalizeDashboardRoute(route);
  const renderer = DASHBOARD_RENDERERS[normalizedRoute];
  if (!renderer) return "";

  return renderer.render(data, {
    period: store.currentDashboardPeriod,
    ...renderer.getProps(),
  });
}

function mountAnalyticsDashboardCharts(route, data) {
  const normalizedRoute = normalizeDashboardRoute(route);
  const renderer = DASHBOARD_RENDERERS[normalizedRoute];
  renderer?.mount(data);
}

export async function renderAnalyticsDashboardPage(route = getRoute()) {
  const normalizedRoute = normalizeDashboardRoute(route);
  destroyAllCharts();
  app.innerHTML = renderDashboardSkeleton();

  try {
    await loadAnalyticsDashboard(normalizedRoute, store.currentDashboardPeriod);

    app.innerHTML = renderAnalyticsDashboardView(normalizedRoute, store.analyticsDashboardData);
    mountAnalyticsDashboardCharts(normalizedRoute, store.analyticsDashboardData);
    initDashboardScrollHints(app);
  } catch (error) {
    app.innerHTML = `
      <section class="app-page">
        <div class="empty-state">
          <div>
            <i class="fa-solid fa-triangle-exclamation"></i>
            <p>${error.message || "Não foi possível carregar o dashboard."}</p>
            <button class="btn-primary" type="button" data-action="retry-dashboard">Tentar novamente</button>
          </div>
        </div>
      </section>
    `;
  }
}

export async function reloadDashboardWithPeriod(period) {
  if (period === store.currentDashboardPeriod && store.analyticsDashboardData) return;

  store.currentDashboardPeriod = period;
  store.analyticsDashboardData = null;
  store.analyticsDashboardPayload = null;
  destroyAllCharts();
  app.innerHTML = renderDashboardSkeleton();

  try {
    await loadAnalyticsDashboard(store.currentAnalyticsRoute, period);
    app.innerHTML = renderAnalyticsDashboardView(store.currentAnalyticsRoute, store.analyticsDashboardData);
    mountAnalyticsDashboardCharts(store.currentAnalyticsRoute, store.analyticsDashboardData);
    initDashboardScrollHints(app);
  } catch (error) {
    showToast(error.message || "Não foi possível atualizar o período.");
    await renderAnalyticsDashboardPage(store.currentAnalyticsRoute);
  }
}

export async function loadGeneralDashboard(period = store.currentDashboardPeriod) {
  return loadAnalyticsDashboard("dashboards/geral", period);
}

export async function renderDashboardPage() {
  return renderAnalyticsDashboardPage("dashboards/geral");
}
