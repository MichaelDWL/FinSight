export function renderDashboardSkeleton() {
  return `
    <section class="app-page dashboard-page">
      <div class="dashboard-skeleton-hero skeleton"></div>
      <div class="dashboard-skeleton-filters skeleton"></div>
      <div class="metrics-grid dashboard-metrics">
        ${Array.from({ length: 4 })
          .map(() => `<div class="metric-card skeleton"></div>`)
          .join("")}
      </div>
      <div class="dashboard-skeleton-grid">
        <div class="chart-card skeleton dashboard-chart-skeleton"></div>
        <div class="chart-card skeleton dashboard-chart-skeleton"></div>
      </div>
    </section>
  `;
}
