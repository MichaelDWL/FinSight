export const DASHBOARD_PERIODS = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "3m", label: "3 meses" },
  { id: "6m", label: "6 meses" },
  { id: "1y", label: "1 ano" },
];

export function renderPeriodFilter(activePeriod = "30d") {
  return `
    <div class="dashboard-scroll-rail" data-scroll-hint="true">
      <div class="dashboard-period-filter" role="group" aria-label="Filtrar período">
        ${DASHBOARD_PERIODS.map(
          (period) => `
            <button
              class="dashboard-period-btn ${period.id === activePeriod ? "is-active" : ""}"
              type="button"
              data-action="dashboard-period"
              data-period="${period.id}"
              aria-pressed="${period.id === activePeriod}"
            >${period.label}</button>
          `,
        ).join("")}
      </div>
    </div>
  `;
}
