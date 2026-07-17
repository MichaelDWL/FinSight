import { chartService } from "../../../services/chartService.js";
import { mountChart } from "../../../charts/ChartWrapper.js";
import { renderPeriodFilter } from "../shared/PeriodFilter.js";
import { renderDashboardNav } from "../shared/DashboardNav.js";
import { periodLabel } from "../shared/periodLabels.js";
import { renderOrderedMetrics, profileBadge } from "../shared/dashboardUi.js";

function formatDate(isoDate) {
  if (!isoDate) return "";
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(`${String(isoDate).slice(0, 10)}T00:00:00`),
  );
}

export function renderExpensesDashboard(data, { period = "30d" } = {}) {
  const kpis = data?.kpis || {};
  const trends = data?.trends || {};
  const projection = data?.projection || {};
  const topExpenses = data?.lists?.topExpenses || [];
  const fastestGrowing = data?.lists?.fastestGrowing || [];
  const label = periodLabel(period);
  const kpiOrder = data?.kpiOrder || [];
  const personalization = data?.personalization || null;

  const metricCatalog = {
    total: {
      label: "Total de gastos",
      value: chartService.formatBRL(kpis.total),
      icon: "fa-arrow-trend-down",
      caption: `No ${label}`,
      tone: "expense",
      trend: trends.total,
    },
    avgDaily: {
      label: "Média diária",
      value: chartService.formatBRL(kpis.avgDaily),
      icon: "fa-calendar-day",
      caption: "Gasto médio por dia",
      tone: "expense",
    },
    projectedMonthEnd: {
      label: "Previsão fim do mês",
      value: chartService.formatBRL(kpis.projectedMonthEnd),
      icon: "fa-chart-line",
      caption: `Projeção linear · ${projection.daysRemaining || 0} dias restantes`,
      tone: "brand",
    },
    transactionsCount: {
      label: "Lançamentos",
      value: String(kpis.transactionsCount || 0),
      icon: "fa-receipt",
      caption: "Despesas no período",
      tone: "brand",
    },
  };

  return `
    <section class="app-page dashboard-page">
      <div class="page-hero dashboard-hero">
        <div>
          <span class="page-eyebrow">Dashboard de Gastos</span>
          <h1 class="page-title">Análise detalhada de despesas</h1>
          <p class="page-subtitle">Entenda para onde vai seu dinheiro · ${label} ${profileBadge(personalization)}</p>
        </div>
      </div>

      ${renderDashboardNav("dashboards/gastos")}
      ${renderPeriodFilter(period)}

      <section class="home-section">
        <div class="metrics-grid dashboard-metrics">
          ${renderOrderedMetrics(metricCatalog, kpiOrder, kpis)}
        </div>
      </section>

      <section class="home-section dashboard-charts-grid">
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Gastos por categoria</h2>
          </div>
          <div id="expenses-category-chart" class="dashboard-chart-host" data-chart="expenses-category"></div>
        </section>
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Gastos por dia</h2>
          </div>
          <div id="expenses-day-chart" class="dashboard-chart-host" data-chart="expenses-day"></div>
        </section>
      </section>

      <section class="home-section dashboard-charts-grid">
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Evolução mensal</h2>
            <span class="home-section-meta">Últimos 12 meses</span>
          </div>
          <div id="expenses-evolution-chart" class="dashboard-chart-host" data-chart="expenses-evolution"></div>
        </section>
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Comparativo por categoria</h2>
            <span class="pill">Atual vs anterior</span>
          </div>
          <div id="expenses-comparison-chart" class="dashboard-chart-host" data-chart="expenses-comparison"></div>
        </section>
      </section>

      <section class="home-section home-bottom-grid">
        <section class="premium-card">
          <div class="card-title-row">
            <h2>Top 10 maiores gastos</h2>
          </div>
          <div class="mini-list">
            ${
              topExpenses.length
                ? topExpenses
                    .map(
                      (item) => `
                  <div class="list-item">
                    <div class="item-left">
                      <span class="item-icon text-expense"><i class="fa-solid fa-receipt"></i></span>
                      <div>
                        <p class="item-title">${item.description}</p>
                        <p class="item-meta">${item.category} · ${formatDate(item.date)}</p>
                      </div>
                    </div>
                    <strong class="amount-negative">${chartService.formatBRL(item.value)}</strong>
                  </div>
                `,
                    )
                    .join("")
                : `<div class="empty-state compact"><div><i class="fa-solid fa-receipt"></i><p>Sem gastos no período.</p></div></div>`
            }
          </div>
        </section>

        <section class="premium-card">
          <div class="card-title-row">
            <h2>Categorias que mais cresceram</h2>
          </div>
          <div class="mini-list">
            ${
              fastestGrowing.length
                ? fastestGrowing
                    .map(
                      (item) => `
                  <div class="list-item">
                    <div class="item-left">
                      <span class="item-icon" style="color:${item.color || "inherit"}"><i class="fa-solid fa-arrow-trend-up"></i></span>
                      <div>
                        <p class="item-title">${item.category}</p>
                        <p class="item-meta">${chartService.formatBRL(item.currentPeriod)} no período</p>
                      </div>
                    </div>
                    <span class="pill">+${item.growth}%</span>
                  </div>
                `,
                    )
                    .join("")
                : `<div class="empty-state compact"><div><i class="fa-solid fa-chart-line"></i><p>Nenhuma categoria em alta relevante.</p></div></div>`
            }
          </div>
        </section>
      </section>
    </section>
  `;
}

export function mountExpensesDashboardCharts(data) {
  const byCategory = data?.charts?.byCategory || [];
  const byDay = data?.charts?.byDay || [];
  const byMonth = data?.charts?.byMonth || [];
  const categoryComparison = data?.charts?.categoryComparison || [];

  const categoryEl = document.querySelector("#expenses-category-chart");
  const dayEl = document.querySelector("#expenses-day-chart");
  const evolutionEl = document.querySelector("#expenses-evolution-chart");
  const comparisonEl = document.querySelector("#expenses-comparison-chart");

  if (categoryEl && byCategory.length) {
    mountChart(categoryEl, chartService.donutChart(byCategory));
  } else if (categoryEl) {
    categoryEl.innerHTML = `<div class="home-flow-empty">Sem gastos por categoria.</div>`;
  }

  if (dayEl && byDay.length) {
    mountChart(
      dayEl,
      chartService.barChart({
        categories: byDay.map((item) => item.label),
        series: [{ name: "Gastos", data: byDay.map((item) => item.value) }],
        height: 300,
      }),
    );
  } else if (dayEl) {
    dayEl.innerHTML = `<div class="home-flow-empty">Sem gastos diários no período.</div>`;
  }

  if (evolutionEl && byMonth.length) {
    mountChart(
      evolutionEl,
      chartService.areaChart({
        categories: byMonth.map((item) => chartService.monthLabel(item.month)),
        series: [{ name: "Gastos", data: byMonth.map((item) => item.value) }],
        colors: [getComputedStyle(document.documentElement).getPropertyValue("--expense").trim() || "#ef5d86"],
      }),
    );
  } else if (evolutionEl) {
    evolutionEl.innerHTML = `<div class="home-flow-empty">Sem evolução mensal disponível.</div>`;
  }

  if (comparisonEl && categoryComparison.length) {
    const topComparison = categoryComparison
      .filter((item) => item.currentPeriod > 0 || item.previousPeriod > 0)
      .sort((a, b) => b.currentPeriod - a.currentPeriod)
      .slice(0, 8);
    mountChart(comparisonEl, chartService.groupedComparisonChart(topComparison));
  } else if (comparisonEl) {
    comparisonEl.innerHTML = `<div class="home-flow-empty">Sem comparativo disponível.</div>`;
  }
}
