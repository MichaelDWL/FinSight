import { chartService } from "../../../services/chartService.js";
import { mountChart } from "../../../components/charts/ChartWrapper.js";
import { renderPeriodFilter } from "../shared/PeriodFilter.js";
import { renderDashboardNav } from "../shared/DashboardNav.js";
import { periodLabel } from "../shared/periodLabels.js";
import { renderOrderedMetrics, profileBadge } from "../shared/dashboardUi.js";
import {
  formatMoney,
  formatPercent,
  renderEconomicRatesStrip,
  renderPortfolioProjectionBlock,
} from "../../investments/form.js";

function formatDate(isoDate) {
  if (!isoDate) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(`${String(isoDate).slice(0, 10)}T00:00:00`),
  );
}

function renderIntelligenceCard(intelligence = {}) {
  const returnByType = intelligence.returnByType || [];
  if (!returnByType.length && !intelligence.largestPosition) return "";

  const typeRows = returnByType
    .map(
      (item) => `
      <div class="list-item">
        <div class="item-left">
          <span class="item-icon"><i class="fa-solid fa-chart-pie"></i></span>
          <div>
            <p class="item-title">${item.type}</p>
            <p class="item-meta">${item.count} ativo(s)</p>
          </div>
        </div>
        <div class="home-transaction-side">
          <strong>${formatMoney(item.value)}</strong>
          <small class="item-meta">${formatPercent(item.returnRate)}</small>
        </div>
      </div>
    `,
    )
    .join("");

  return `
    <section class="premium-card">
      <div class="card-title-row">
        <h2>Rentabilidade por tipo</h2>
      </div>
      <div class="mini-list">${typeRows || `<div class="empty-state compact"><div><p>Sem dados por tipo.</p></div></div>`}</div>
    </section>
  `;
}

export function renderInvestmentsDashboard(data, { period = "30d" } = {}) {
  const kpis = data?.kpis || {};
  const projection = data?.projection || {};
  const investments = data?.lists?.investments || [];
  const topPerformers = data?.lists?.topPerformers || [];
  const rates = data?.economicRates || {};
  const portfolioProjection = data?.portfolioProjection;
  const intelligence = data?.portfolioIntelligence || {};
  const label = periodLabel(period);
  const projected12 =
    portfolioProjection?.horizons?.find((item) => item.months === 12)
      ?.estimatedWealth ?? kpis.projectedPatrimonio;
  const kpiOrder = data?.kpiOrder || [];
  const personalization = data?.personalization || null;

  const metricCatalog = {
    patrimonio: {
      label: "Patrimônio investido",
      value: chartService.formatBRL(kpis.patrimonio),
      icon: "fa-gem",
      caption: `${kpis.investmentsCount || 0} ativo(s)`,
      tone: "brand",
    },
    lucro: {
      label: "Lucro / prejuízo",
      value: chartService.formatBRL(kpis.lucro),
      icon: "fa-sack-dollar",
      caption: "Resultado da carteira",
      tone: kpis.lucro >= 0 ? "income" : "expense",
    },
    accumulatedReturn: {
      label: "Rentabilidade acumulada",
      value: formatPercent(kpis.accumulatedReturn),
      icon: "fa-chart-line",
      caption: `Lucro ${chartService.formatBRL(kpis.lucro)}`,
      tone: kpis.accumulatedReturn >= 0 ? "income" : "expense",
    },
    monthlyReturn: {
      label: "Rentabilidade mensal",
      value: formatPercent(kpis.monthlyReturn),
      icon: "fa-calendar-day",
      caption: "Último mês com snapshot",
      tone: kpis.monthlyReturn >= 0 ? "income" : "expense",
    },
    projectedPatrimonio: {
      label: "Projeção 12 meses",
      value: chartService.formatBRL(projected12),
      icon: "fa-rocket",
      caption: portfolioProjection
        ? "Motor de projeção (RF + RV atual)"
        : `Média ${formatPercent(projection.avgMonthlyReturn)}/mês`,
      tone: "brand",
    },
    totalAportado: {
      label: "Total aportado",
      value: chartService.formatBRL(kpis.totalAportado),
      icon: "fa-piggy-bank",
      caption: "Capital investido",
      tone: "brand",
    },
    investmentsCount: {
      label: "Ativos",
      value: String(kpis.investmentsCount || 0),
      icon: "fa-layer-group",
      caption: "Na carteira",
      tone: "brand",
    },
  };

  return `
    <section class="app-page dashboard-page">
      <div class="page-hero dashboard-hero">
        <div>
          <span class="page-eyebrow">Dashboard de Investimentos</span>
          <h1 class="page-title">Patrimônio e rentabilidade</h1>
          <p class="page-subtitle">Acompanhe a evolução da sua carteira · ${label} ${profileBadge(personalization)}</p>
        </div>
        <div class="hero-actions">
          <a class="btn-secondary" href="#patrimonio">
            <i class="fa-solid fa-wallet"></i> Ver carteira
          </a>
        </div>
      </div>

      ${renderDashboardNav("dashboards/investimentos")}
      ${renderPeriodFilter(period)}

      <section class="home-section">
        <div class="metrics-grid dashboard-metrics">
          ${renderOrderedMetrics(metricCatalog, kpiOrder.slice(0, 4), kpis)}
        </div>
      </section>

      <section class="home-section">
        ${renderEconomicRatesStrip(rates)}
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
        ${renderPortfolioProjectionBlock(portfolioProjection)}
        ${renderIntelligenceCard(intelligence)}
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
