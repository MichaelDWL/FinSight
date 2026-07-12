import { chartService } from "../../../services/chartService.js";
import { mountChart } from "../../../charts/ChartWrapper.js";
import { renderPeriodFilter } from "../shared/PeriodFilter.js";
import { renderDashboardNav } from "../shared/DashboardNav.js";
import { periodLabel } from "../shared/periodLabels.js";
import { renderMetricCard } from "../shared/dashboardUi.js";

function formatDate(isoDate) {
  if (!isoDate) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(`${String(isoDate).slice(0, 10)}T00:00:00`),
  );
}

function formatPercent(value) {
  const num = Number(value) || 0;
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

export function renderInvestmentsDashboard(data, { period = "30d" } = {}) {
  const kpis = data?.kpis || {};
  const projection = data?.projection || {};
  const investments = data?.lists?.investments || [];
  const topPerformers = data?.lists?.topPerformers || [];
  const label = periodLabel(period);

  return `
    <section class="app-page dashboard-page">
      <div class="page-hero dashboard-hero">
        <div>
          <span class="page-eyebrow">Dashboard de Investimentos</span>
          <h1 class="page-title">Patrimônio e rentabilidade</h1>
          <p class="page-subtitle">Acompanhe a evolução da sua carteira · ${label}</p>
        </div>
        <div class="hero-actions">
          <a class="btn-secondary" href="#patrimonio">
            <i class="fa-solid fa-wallet"></i> Ver carteira
          </a>
        </div>
      </div>

      ${renderDashboardNav("dashboard/investimentos")}
      ${renderPeriodFilter(period)}

      <section class="home-section">
        <div class="metrics-grid dashboard-metrics">
          ${renderMetricCard(
            "Patrimônio investido",
            chartService.formatBRL(kpis.patrimonio),
            "fa-gem",
            `${kpis.investmentsCount || 0} ativo(s)`,
            "brand",
          )}
          ${renderMetricCard(
            "Rentabilidade acumulada",
            formatPercent(kpis.accumulatedReturn),
            "fa-chart-line",
            `Lucro ${chartService.formatBRL(kpis.lucro)}`,
            kpis.accumulatedReturn >= 0 ? "income" : "expense",
          )}
          ${renderMetricCard(
            "Rentabilidade mensal",
            formatPercent(kpis.monthlyReturn),
            "fa-calendar-day",
            "Último mês com snapshot",
            kpis.monthlyReturn >= 0 ? "income" : "expense",
          )}
          ${renderMetricCard(
            "Projeção 12 meses",
            chartService.formatBRL(kpis.projectedPatrimonio),
            "fa-rocket",
            `Média ${formatPercent(projection.avgMonthlyReturn)}/mês`,
            "brand",
          )}
        </div>
      </section>

      <section class="home-section dashboard-charts-grid">
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Evolução do patrimônio</h2>
            <span class="home-section-meta">Últimos 12 meses</span>
          </div>
          <div id="investments-wealth-chart" class="dashboard-chart-host" data-chart="investments-wealth"></div>
        </section>
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Distribuição por categoria</h2>
          </div>
          <div id="investments-distribution-chart" class="dashboard-chart-host" data-chart="investments-distribution"></div>
        </section>
      </section>

      <section class="home-section dashboard-charts-grid">
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Histórico de aportes</h2>
          </div>
          <div id="investments-contributions-chart" class="dashboard-chart-host" data-chart="investments-contributions"></div>
        </section>
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Comparativo com índices</h2>
            <span class="pill">CDI · Selic · IPCA</span>
          </div>
          <div id="investments-benchmark-chart" class="dashboard-chart-host" data-chart="investments-benchmark"></div>
        </section>
      </section>

      <section class="home-section home-bottom-grid">
        <section class="premium-card">
          <div class="card-title-row">
            <h2>Carteira de investimentos</h2>
          </div>
          <div class="mini-list">
            ${
              investments.length
                ? investments
                    .map(
                      (item) => `
                  <div class="list-item">
                    <div class="item-left">
                      <span class="item-icon" style="color:${item.color || "var(--brand-accent)"}"><i class="fa-solid fa-chart-line"></i></span>
                      <div>
                        <p class="item-title">${item.name}</p>
                        <p class="item-meta">${item.category} · ${item.institution} · ${formatDate(item.date)}</p>
                      </div>
                    </div>
                    <div class="home-transaction-side">
                      <strong class="${item.profit >= 0 ? "amount-positive" : "amount-negative"}">${chartService.formatBRL(item.currentValue)}</strong>
                      <small class="item-meta">${formatPercent(item.returnRate)}</small>
                    </div>
                  </div>
                `,
                    )
                    .join("")
                : `<div class="empty-state compact"><div><i class="fa-solid fa-chart-line"></i><p>Nenhum investimento cadastrado.</p></div></div>`
            }
          </div>
        </section>

        <section class="premium-card">
          <div class="card-title-row">
            <h2>Melhores desempenhos</h2>
          </div>
          <div class="mini-list">
            ${
              topPerformers.length
                ? topPerformers
                    .map(
                      (item) => `
                  <div class="list-item">
                    <div class="item-left">
                      <span class="item-icon text-income"><i class="fa-solid fa-arrow-trend-up"></i></span>
                      <div>
                        <p class="item-title">${item.name}</p>
                        <p class="item-meta">${item.category}</p>
                      </div>
                    </div>
                    <span class="pill">${formatPercent(item.returnRate)}</span>
                  </div>
                `,
                    )
                    .join("")
                : `<div class="empty-state compact"><div><i class="fa-solid fa-trophy"></i><p>Sem rentabilidade positiva registrada.</p></div></div>`
            }
          </div>
        </section>
      </section>
    </section>
  `;
}

export function mountInvestmentsDashboardCharts(data) {
  const wealthEvolution = data?.charts?.wealthEvolution || [];
  const distribution = data?.charts?.distribution || [];
  const contributionsHistory = data?.charts?.contributionsHistory || [];
  const benchmarkComparison = data?.charts?.benchmarkComparison || [];

  const wealthEl = document.querySelector("#investments-wealth-chart");
  const distributionEl = document.querySelector("#investments-distribution-chart");
  const contributionsEl = document.querySelector("#investments-contributions-chart");
  const benchmarkEl = document.querySelector("#investments-benchmark-chart");

  if (wealthEl && wealthEvolution.length) {
    mountChart(wealthEl, chartService.wealthEvolutionChart(wealthEvolution));
  } else if (wealthEl) {
    wealthEl.innerHTML = `<div class="home-flow-empty">Sem histórico de patrimônio.</div>`;
  }

  if (distributionEl && distribution.length) {
    mountChart(distributionEl, chartService.donutChart(distribution));
  } else if (distributionEl) {
    distributionEl.innerHTML = `<div class="home-flow-empty">Sem investimentos para distribuir.</div>`;
  }

  if (contributionsEl && contributionsHistory.length) {
    mountChart(
      contributionsEl,
      chartService.barChart({
        categories: contributionsHistory.map((item) => chartService.monthLabel(item.month)),
        series: [{ name: "Aportes", data: contributionsHistory.map((item) => item.value) }],
        colors: [getComputedStyle(document.documentElement).getPropertyValue("--income").trim() || "#14b8a6"],
        height: 300,
      }),
    );
  } else if (contributionsEl) {
    contributionsEl.innerHTML = `<div class="home-flow-empty">Sem histórico de aportes.</div>`;
  }

  if (benchmarkEl && benchmarkComparison.length) {
    mountChart(benchmarkEl, chartService.benchmarkComparisonChart(benchmarkComparison));
  } else if (benchmarkEl) {
    benchmarkEl.innerHTML = `<div class="home-flow-empty">Índices de referência indisponíveis.</div>`;
  }
}
