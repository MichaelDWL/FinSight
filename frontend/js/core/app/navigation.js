import { pageTitle, quickAction, quickActionMenu } from "./elements.js";
import { routeTitles } from "../router.js";
import { normalizeDashboardRoute } from "../../modules/dashboard/shared/periodLabels.js";
import { isAnalyticsDashboardRoute } from "./analyticsDashboard.js";

export function closeQuickActionMenu() {
  quickActionMenu?.classList.add("is-hidden");
  quickAction?.setAttribute("aria-expanded", "false");
}

export function setInvestmentsMenuExpanded(expanded) {
  const group = document.querySelector("[data-nav-group='investments']");
  const toggle = group?.querySelector(
    "[data-action='toggle-investments-menu']",
  );
  if (!group || !toggle) return;

  group.classList.toggle("nav-group-open", expanded);
  toggle.setAttribute("aria-expanded", String(expanded));
}

export function toggleInvestmentsMenu() {
  const group = document.querySelector("[data-nav-group='investments']");
  setInvestmentsMenuExpanded(!group?.classList.contains("nav-group-open"));
}

export function setAccountsMenuExpanded(expanded) {
  const group = document.querySelector("[data-nav-group='accounts']");
  const toggle = group?.querySelector("[data-action='toggle-accounts-menu']");
  if (!group || !toggle) return;

  group.classList.toggle("nav-group-open", expanded);
  toggle.setAttribute("aria-expanded", String(expanded));
}

export function toggleAccountsMenu() {
  const group = document.querySelector("[data-nav-group='accounts']");
  setAccountsMenuExpanded(!group?.classList.contains("nav-group-open"));
}

export function setDashboardsMenuExpanded(expanded) {
  const group = document.querySelector("[data-nav-group='dashboards']");
  const toggle = group?.querySelector("[data-action='toggle-dashboards-menu']");
  if (!group || !toggle) return;

  group.classList.toggle("nav-group-open", expanded);
  toggle.setAttribute("aria-expanded", String(expanded));
}

export function toggleDashboardsMenu() {
  const group = document.querySelector("[data-nav-group='dashboards']");
  setDashboardsMenuExpanded(!group?.classList.contains("nav-group-open"));
}

export function setDashboardSubroute(activeRoute) {
  document
    .querySelectorAll("[data-nav-group='dashboards'] .nav-submenu [data-route]")
    .forEach((item) => {
      item.classList.toggle(
        "nav-subitem-active",
        item.dataset.route === activeRoute,
      );
    });
}

export function setInvestmentSubroute(activeRoute) {
  document
    .querySelectorAll(".nav-submenu [data-route], .nav-submenu [data-subroute]")
    .forEach((item) => {
      const route = item.dataset.route || item.dataset.subroute;
      item.classList.toggle("nav-subitem-active", route === activeRoute);
    });
}

export function setAccountSubroute(activeRoute) {
  document
    .querySelectorAll("[data-nav-group='accounts'] .nav-submenu [data-route]")
    .forEach((item) => {
      item.classList.toggle(
        "nav-subitem-active",
        item.dataset.route === activeRoute,
      );
    });
}

export function setActiveRoute(route) {
  const accountRoutes = [
    "contas-resumo",
    "contas-bancos",
    "contas-despesas",
    "contas-cartoes",
    "cartao-detalhe",
    "conta-detalhe",
  ];
  const activeRoute = ["investimento-novo", "investimento-detalhe"].includes(
    route,
  )
    ? "patrimonio"
    : isAnalyticsDashboardRoute(route)
      ? "dashboards"
      : accountRoutes.includes(route)
        ? "contas-resumo"
        : route;

  document.querySelectorAll("[data-route]").forEach((link) => {
    if (link.closest(".mobile-bottom-nav")) return;

    const targetRoute = link.closest(".nav-submenu") ? route : activeRoute;
    const isActive = link.dataset.route === targetRoute;
    link.classList.toggle("nav-link-active", isActive);
    link.closest(".nav-item")?.classList.toggle("nav-active", isActive);
  });

  const investmentRoutes = [
    "patrimonio",
    "investimento-novo",
    "investimento-detalhe",
  ];
  const canExpandNavGroups =
    !document.body.classList.contains("sidebar-closed") ||
    window.matchMedia("(max-width: 767px)").matches;

  const isInvestmentRoute = investmentRoutes.includes(route);
  document
    .querySelector("[data-nav-group='investments']")
    ?.classList.toggle("nav-active", isInvestmentRoute);
  if (isInvestmentRoute && canExpandNavGroups) setInvestmentsMenuExpanded(true);
  setInvestmentSubroute(route);

  const isAccountRoute = accountRoutes.includes(route);
  document
    .querySelector("[data-nav-group='accounts']")
    ?.classList.toggle("nav-active", isAccountRoute);
  if (isAccountRoute && canExpandNavGroups) setAccountsMenuExpanded(true);
  const accountSubroute =
    route === "cartao-detalhe"
      ? "contas-cartoes"
      : route === "conta-detalhe"
        ? "contas-bancos"
        : route;
  setAccountSubroute(accountSubroute);

  const dashboardRoutes = [
    "dashboards",
    "dashboards/geral",
    "dashboards/gastos",
    "dashboards/fluxo-caixa",
    "dashboards/cartoes",
    "dashboards/investimentos",
  ];
  const isDashboardRoute = dashboardRoutes.includes(route);
  document
    .querySelector("[data-nav-group='dashboards']")
    ?.classList.toggle("nav-active", isDashboardRoute);
  if (isDashboardRoute && canExpandNavGroups) {
    setDashboardsMenuExpanded(true);
  }
  setDashboardSubroute(normalizeDashboardRoute(route));

  document.querySelectorAll(".mobile-bottom-nav-link").forEach((link) => {
    const key = link.dataset.mobileNav;
    const isActive =
      (key === "home" && route === "dashboard") ||
      (key === "dashboard" && isDashboardRoute) ||
      (key === "movements" && route === "transacoes") ||
      (key === "wealth" && isInvestmentRoute) ||
      (key === "profile" && route === "perfil");

    link.classList.toggle("is-active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  pageTitle.textContent =
    routeTitles[route] ||
    routeTitles[normalizeDashboardRoute(route)] ||
    "Home";
  quickAction.querySelector(".fab-add-label").textContent = "Nova Movimentação";
}
