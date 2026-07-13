export const DASHBOARD_NAV = [
  {
    id: "dashboards/geral",
    label: "Geral",
    icon: "fa-chart-pie",
    href: "#dashboards/geral",
    available: true,
  },
  {
    id: "dashboards/gastos",
    label: "Gastos",
    icon: "fa-cart-shopping",
    href: "#dashboards/gastos",
    available: true,
  },
  {
    id: "dashboards/fluxo-caixa",
    label: "Fluxo de Caixa",
    icon: "fa-water",
    href: "#dashboards/fluxo-caixa",
    available: true,
  },
  {
    id: "dashboards/cartoes",
    label: "Cartões",
    icon: "fa-credit-card",
    href: "#dashboards/cartoes",
    available: true,
  },
  {
    id: "dashboards/investimentos",
    label: "Investimentos",
    icon: "fa-chart-line",
    href: "#dashboards/investimentos",
    available: true,
  },
];

export function renderDashboardNav(activeRoute = "dashboards/geral") {
  return `
    <nav class="dashboard-nav" aria-label="Dashboards">
      ${DASHBOARD_NAV.map((item) => {
        const isActive = item.id === activeRoute;
        if (!item.available) {
          return `
            <span class="dashboard-nav-link is-disabled" title="Em breve">
              <i class="fa-solid ${item.icon}"></i>
              ${item.label}
            </span>
          `;
        }
        return `
          <a
            class="dashboard-nav-link ${isActive ? "is-active" : ""}"
            href="${item.href}"
            data-route="${item.id}"
            aria-current="${isActive ? "page" : "false"}"
          >
            <i class="fa-solid ${item.icon}"></i>
            ${item.label}
          </a>
        `;
      }).join("")}
    </nav>
  `;
}
