import { chartService } from "../../../services/chartService.js";
import { mountChart } from "../../../components/charts/ChartWrapper.js";
import { renderPeriodFilter } from "../shared/PeriodFilter.js";
import { renderDashboardNav } from "../shared/DashboardNav.js";
import { periodLabel } from "../shared/periodLabels.js";
import { renderOrderedMetrics, profileBadge } from "../shared/dashboardUi.js";

export function renderCashflowDashboard(data, { period = "30d" } = {}) {
  const kpis = data?.kpis || {};
  const projection = data?.projection || {};
  const label = periodLabel(period);
  const kpiOrder = data?.kpiOrder || [];
  const personalization = data?.personalization || null;

  const primaryCatalog = {
    income: {
      label: "Entradas",
      value: chartService.formatBRL(kpis.income),
      icon: "fa-arrow-trend-up",
      caption: `Receitas no ${label}`,
      tone: "income",
    },
    expenses: {
      label: "Saídas",
      value: chartService.formatBRL(kpis.expenses),
      icon: "fa-arrow-trend-down",
      caption: `Despesas no ${label}`,
      tone: "expense",
    },
    net: {
      label: "Saldo do período",
      value: chartService.formatBRL(kpis.net),
      icon: "fa-scale-balanced",
      caption: "Entradas menos saídas",
      tone: kpis.net >= 0 ? "income" : "expense",
    },
    currentBalance: {
      label: "Saldo disponível",
      value: chartService.formatBRL(kpis.currentBalance),
      icon: "fa-wallet",
      caption: "Nas contas ativas",
      tone: "brand",
    },
    projectedBalance: {
      label: "Projeção fim do mês",
      value: chartService.formatBRL(kpis.projectedBalance),
      icon: "fa-chart-line",
      caption: `${projection.daysRemaining || 0} dias restantes`,
      tone: "brand",
    },
    accumulatedBalance: {
      label: "Saldo acumulado",
      value: chartService.formatBRL(kpis.accumulatedBalance),
      icon: "fa-layer-group",
      caption: "Fluxo líquido acumulado",
      tone: "brand",
    },
    avgDailyIncome: {
      label: "Média diária de receitas",
      value: chartService.formatBRL(kpis.avgDailyIncome),
      icon: "fa-coins",
      caption: "Baseado no período",
      tone: "income",
    },
    avgDailyExpense: {
      label: "Média diária de gastos",
      value: chartService.formatBRL(kpis.avgDailyExpense),
      icon: "fa-money-bill-wave",
      caption: "Baseado no período",
      tone: "expense",
    },
  };

  const primaryOrder = (kpiOrder.length
    ? kpiOrder
    : ["income", "expenses", "net", "currentBalance"]
  ).slice(0, 4);

  return `
    <section class="app-page dashboard-page">
      <div class="page-hero dashboard-hero">
        <div>
          <span class="page-eyebrow">Dashboard de Fluxo de Caixa</span>
          <h1 class="page-title">Entradas, saídas e projeções</h1>
          <p class="page-subtitle">Acompanhe a liquidez do seu dinheiro · ${label} ${profileBadge(personalization)}</p>
        </div>
      </div>

      ${renderDashboardNav("dashboards/fluxo-caixa")}
      ${renderPeriodFilter(period)}

      <section class="home-section">
        <div class="metrics-grid dashboard-metrics">
          ${renderOrderedMetrics(primaryCatalog, primaryOrder, kpis)}
        </div>
      </section>

      <section class="home-section">
        <div class="metrics-grid dashboard-metrics dashboard-metrics-secondary">
          ${renderOrderedMetrics(
            primaryCatalog,
            Object.keys(primaryCatalog).filter((key) => !primaryOrder.includes(key)),
            kpis,
          )}
        </div>
      </section>

      <section class="home-section dashboard-charts-grid">
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Entradas x Saídas</h2>
          </div>
          <div id="cashflow-entries-chart" class="dashboard-chart-host" data-chart="cashflow-entries"></div>
        </section>
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Saldo acumulado</h2>
          </div>
          <div id="cashflow-accumulated-chart" class="dashboard-chart-host" data-chart="cashflow-accumulated"></div>
        </section>
      </section>

      <section class="home-section dashboard-charts-grid">
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Fluxo diário</h2>
          </div>
          <div id="cashflow-daily-chart" class="dashboard-chart-host" data-chart="cashflow-daily"></div>
        </section>
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Fluxo semanal</h2>
          </div>
          <div id="cashflow-weekly-chart" class="dashboard-chart-host" data-chart="cashflow-weekly"></div>
        </section>
      </section>

      <section class="home-section">
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Fluxo mensal</h2>
            <span class="home-section-meta">Últimos 12 meses</span>
          </div>
          <div id="cashflow-monthly-chart" class="dashboard-chart-host" data-chart="cashflow-monthly"></div>
        </section>
      </section>
    </section>
  `;
}

export function mountCashflowDashboardCharts(data) {
  const entriesVsExits = data?.charts?.entriesVsExits || {};
  const dailyFlow = data?.charts?.dailyFlow || [];
  const weeklyFlow = data?.charts?.weeklyFlow || [];
  const monthlyFlow = data?.charts?.monthlyFlow || [];
  const accumulated = data?.charts?.accumulatedBalance || [];

  const entriesEl = document.querySelector("#cashflow-entries-chart");
  const accumulatedEl = document.querySelector("#cashflow-accumulated-chart");
  const dailyEl = document.querySelector("#cashflow-daily-chart");
  const weeklyEl = document.querySelector("#cashflow-weekly-chart");
  const monthlyEl = document.querySelector("#cashflow-monthly-chart");

  if (entriesEl) {
    mountChart(entriesEl, chartService.entriesVsExitsChart(entriesVsExits));
  }

  if (accumulatedEl && accumulated.length) {
    mountChart(
      accumulatedEl,
      chartService.areaChart({
        categories: accumulated.map((item) => item.label),
        series: [{ name: "Saldo acumulado", data: accumulated.map((item) => item.value) }],
      }),
    );
  } else if (accumulatedEl) {
    accumulatedEl.innerHTML = `<div class="home-flow-empty">Sem dados de acumulado.</div>`;
  }

  if (dailyEl && dailyFlow.length) {
    mountChart(
      dailyEl,
      chartService.mixedFlowChart(
        dailyFlow.map((item) => ({
          month: item.label,
          income: item.income,
          expenses: item.expenses,
          balance: item.net,
        })),
      ),
    );
  } else if (dailyEl) {
    dailyEl.innerHTML = `<div class="home-flow-empty">Sem fluxo diário no período.</div>`;
  }

  if (weeklyEl && weeklyFlow.length) {
    mountChart(
      weeklyEl,
      chartService.mixedFlowChart(
        weeklyFlow.map((item) => ({
          month: item.label,
          income: item.income,
          expenses: item.expenses,
          balance: item.net,
        })),
      ),
    );
  } else if (weeklyEl) {
    weeklyEl.innerHTML = `<div class="home-flow-empty">Sem fluxo semanal no período.</div>`;
  }

  if (monthlyEl && monthlyFlow.length) {
    mountChart(
      monthlyEl,
      chartService.mixedFlowChart(
        monthlyFlow.map((item) => ({
          month: item.month,
          income: item.income,
          expenses: item.expenses,
          balance: item.net,
        })),
      ),
    );
  } else if (monthlyEl) {
    monthlyEl.innerHTML = `<div class="home-flow-empty">Sem fluxo mensal disponível.</div>`;
  }
}
