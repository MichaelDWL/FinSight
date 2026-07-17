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
    <div class="dashboard-scroll-rail" data-scroll-hint="true">
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
    </div>
  `;
}

function updateScrollRailHint(rail) {
  const scroller = rail.querySelector(".dashboard-nav, .dashboard-period-filter");
  if (!scroller) return;

  const maxScroll = scroller.scrollWidth - scroller.clientWidth;
  const hasOverflow = maxScroll > 4;
  const atEnd = !hasOverflow || scroller.scrollLeft >= maxScroll - 4;

  rail.classList.toggle("is-scrollable", hasOverflow);
  rail.classList.toggle("is-at-end", atEnd);
}

/** Edge fade + chevron only when the rail can scroll. */
export function initDashboardScrollHints(root = document) {
  root.querySelectorAll(".dashboard-scroll-rail[data-scroll-hint]").forEach((rail) => {
    if (rail.dataset.scrollBound === "true") {
      updateScrollRailHint(rail);
      return;
    }

    const scroller = rail.querySelector(".dashboard-nav, .dashboard-period-filter");
    if (!scroller) return;

    const onScroll = () => updateScrollRailHint(rail);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    rail.dataset.scrollBound = "true";
    updateScrollRailHint(rail);
  });
}
