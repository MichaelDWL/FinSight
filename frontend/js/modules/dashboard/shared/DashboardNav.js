export const DASHBOARD_NAV = [
  {
    id: "dashboard/geral",
    label: "Geral",
    icon: "fa-chart-pie",
    href: "#dashboard/geral",
    available: true,
  },
  {
    id: "dashboard/gastos",
    label: "Gastos",
    icon: "fa-cart-shopping",
    href: "#dashboard/gastos",
    available: true,
  },
  {
    id: "dashboard/fluxo-caixa",
    label: "Fluxo de Caixa",
    icon: "fa-water",
    href: "#dashboard/fluxo-caixa",
    available: true,
  },
  {
    id: "dashboard/cartoes",
    label: "Cartões",
    icon: "fa-credit-card",
    href: "#dashboard/cartoes",
    available: true,
  },
  {
    id: "dashboard/investimentos",
    label: "Investimentos",
    icon: "fa-chart-line",
    href: "#dashboard/investimentos",
    available: true,
  },
];

export function renderDashboardNav(activeRoute = "dashboard/geral") {
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
