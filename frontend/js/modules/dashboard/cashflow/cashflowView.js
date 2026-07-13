import { chartService } from "../../../services/chartService.js";
import { mountChart } from "../../../charts/ChartWrapper.js";
import { renderPeriodFilter } from "../shared/PeriodFilter.js";
import { renderDashboardNav } from "../shared/DashboardNav.js";
import { periodLabel } from "../shared/periodLabels.js";
import { renderMetricCard } from "../shared/dashboardUi.js";

export function renderCashflowDashboard(data, { period = "30d" } = {}) {
  const kpis = data?.kpis || {};
  const projection = data?.projection || {};
  const label = periodLabel(period);

  return `
    <section class="app-page dashboard-page">
      <div class="page-hero dashboard-hero">
        <div>
          <span class="page-eyebrow">Dashboard de Fluxo de Caixa</span>
          <h1 class="page-title">Entradas, saídas e projeções</h1>
          <p class="page-subtitle">Acompanhe a liquidez do seu dinheiro · ${label}</p>
        </div>
      </div>

      ${renderDashboardNav("dashboards/fluxo-caixa")}
      ${renderPeriodFilter(period)}

      <section class="home-section">
        <div class="metrics-grid dashboard-metrics">
          ${renderMetricCard(
            "Entradas",
            chartService.formatBRL(kpis.income),
            "fa-arrow-trend-up",
            `Receitas no ${label}`,
            "income",
          )}
          ${renderMetricCard(
            "Saídas",
            chartService.formatBRL(kpis.expenses),
            "fa-arrow-trend-down",
            `Despesas no ${label}`,
            "expense",
          )}
          ${renderMetricCard(
            "Saldo do período",
            chartService.formatBRL(kpis.net),
            "fa-scale-balanced",
            "Entradas menos saídas",
            kpis.net >= 0 ? "income" : "expense",
          )}
          ${renderMetricCard(
            "Saldo disponível",
            chartService.formatBRL(kpis.currentBalance),
            "fa-wallet",
            "Nas contas ativas",
            "brand",
          )}
        </div>
      </section>

      <section class="home-section">
        <div class="metrics-grid dashboard-metrics dashboard-metrics-secondary">
          ${renderMetricCard(
            "Média diária de receitas",
            chartService.formatBRL(kpis.avgDailyIncome),
            "fa-coins",
            "Baseado no período",
            "income",
          )}
          ${renderMetricCard(
            "Média diária de gastos",
            chartService.formatBRL(kpis.avgDailyExpense),
            "fa-money-bill-wave",
            "Baseado no período",
            "expense",
          )}
          ${renderMetricCard(
            "Saldo acumulado",
            chartService.formatBRL(kpis.accumulatedBalance),
            "fa-layer-group",
            "Fluxo líquido acumulado",
            "brand",
          )}
          ${renderMetricCard(
            "Projeção fim do mês",
            chartService.formatBRL(kpis.projectedBalance),
            "fa-chart-line",
            `${projection.daysRemaining || 0} dias restantes`,
            "brand",
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
