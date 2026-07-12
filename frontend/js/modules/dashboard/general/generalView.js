import { chartService } from "../../../services/chartService.js";
import { mountChart } from "../../../charts/ChartWrapper.js";
import { renderPeriodFilter } from "../shared/PeriodFilter.js";
import { renderDashboardNav } from "../shared/DashboardNav.js";
import { periodLabel } from "../shared/periodLabels.js";
import {
  renderMetricCard,
  renderHealthScore,
  renderBillRow,
  renderMovementRow,
  renderInsightItem,
  renderFlowSummaryItem,
} from "../shared/dashboardUi.js";

export function renderGeneralDashboard(data, { firstName = "Usuário", period = "30d" } = {}) {
  const kpis = data?.kpis || {};
  const trends = data?.trends || {};
  const flowSummary = data?.flowSummary || {};
  const upcomingBills = data?.lists?.upcomingBills || [];
  const recentMovements = data?.lists?.recentMovements || [];
  const insights = data?.insights || [];
  const healthScore = data?.healthScore || {};
  const meta = data?.meta || {};

  const topExpense = flowSummary.topExpenseCategory;
  const growingCategory = flowSummary.fastestGrowingCategory;

  const label = periodLabel(period);

  return `
    <section class="app-page dashboard-page home-page">
      <div class="page-hero home-hero dashboard-hero">
        <div>
          <span class="page-eyebrow">Dashboard Geral</span>
          <h1 class="page-title home-greeting">Olá, ${firstName} 👋</h1>
          <p class="page-subtitle home-subtitle">
            Visão executiva do seu financeiro · ${label}
          </p>
        </div>
        <div class="hero-actions">
          <button class="btn-primary" type="button" data-action="add-transaction">
            <i class="fa-solid fa-plus"></i> Nova Movimentação
          </button>
          <a class="btn-secondary" href="#transacoes">
            <i class="fa-solid fa-list"></i> Ver transações
          </a>
        </div>
      </div>

      ${renderDashboardNav("dashboard/geral")}
      ${renderPeriodFilter(period)}

      <section class="home-section">
        <div class="metrics-grid home-metrics dashboard-metrics">
          ${renderMetricCard(
            "Saldo disponível",
            chartService.formatBRL(kpis.balance),
            "fa-wallet",
            "Disponível nas suas contas",
            "brand",
            trends.balance,
          )}
          ${renderMetricCard(
            "Receitas",
            chartService.formatBRL(kpis.income),
            "fa-arrow-trend-up",
            `Entradas no ${label}`,
            "income",
            trends.income,
          )}
          ${renderMetricCard(
            "Despesas",
            chartService.formatBRL(kpis.expenses),
            "fa-arrow-trend-down",
            `Gastos no ${label}`,
            "expense",
            trends.expenses,
          )}
          ${renderMetricCard(
            "Patrimônio",
            chartService.formatBRL(kpis.netWorth),
            "fa-gem",
            "Contas + investimentos",
            "brand",
            trends.netWorth,
          )}
        </div>
      </section>

      <section class="home-section">
        ${renderHealthScore(healthScore)}
      </section>

      <section class="home-section">
        <div class="home-section-head">
          <h2>Fluxo financeiro</h2>
          <span class="home-section-meta">Últimos 12 meses</span>
        </div>
        <div class="home-flow-grid dashboard-charts-grid">
          <section class="chart-card home-flow-card">
            <div id="dashboard-flow-chart" class="dashboard-chart-host" data-chart="flow"></div>
          </section>
          <section class="premium-card home-flow-summary">
            ${renderFlowSummaryItem(
              "Maior categoria de gastos",
              topExpense?.name || "Sem gastos no período",
              topExpense
                ? chartService.formatBRL(topExpense.value)
                : "Cadastre movimentações para ver",
            )}
            ${renderFlowSummaryItem(
              "Categoria que mais cresceu",
              growingCategory?.name || "Nenhuma alta relevante",
              growingCategory
                ? `+${growingCategory.growth}% · ${chartService.formatBRL(growingCategory.value)}`
                : "Comparado ao período anterior",
            )}
            ${renderFlowSummaryItem(
              "Saldo do período",
              chartService.formatBRL(kpis.monthlyBalance),
              kpis.monthlyBalance >= 0 ? "Superávit no período" : "Déficit no período",
            )}
          </section>
        </div>
      </section>

      <section class="home-section dashboard-charts-grid">
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Despesas por categoria</h2>
            <span class="pill">${label}</span>
          </div>
          <div id="dashboard-category-chart" class="dashboard-chart-host" data-chart="category"></div>
        </section>

        <section class="premium-card">
          <div class="card-title-row">
            <h2>Próximas contas</h2>
            <a class="btn-secondary" href="#contas-despesas">Ver todas</a>
          </div>
          <div class="mini-list">
            ${
              upcomingBills.length
                ? upcomingBills.map(renderBillRow).join("")
                : `<div class="empty-state compact"><div><i class="fa-solid fa-calendar-check"></i><p>Nenhuma conta pendente.</p></div></div>`
            }
          </div>
        </section>
      </section>

      <section class="home-section home-bottom-grid">
        <section class="premium-card">
          <div class="card-title-row">
            <h2>Últimas movimentações</h2>
            <a class="btn-secondary" href="#transacoes">Ver todas</a>
          </div>
          <div class="mini-list">
            ${
              recentMovements.length
                ? recentMovements.map(renderMovementRow).join("")
                : `<div class="empty-state compact"><div><i class="fa-solid fa-receipt"></i><p>Nenhuma movimentação registrada ainda.</p></div></div>`
            }
          </div>
        </section>

        <section class="premium-card">
          <div class="card-title-row">
            <h2>Insights inteligentes</h2>
            <span class="pill">Personalizado</span>
          </div>
          <div class="mini-list">
            ${
              insights.length
                ? insights.map(renderInsightItem).join("")
                : `<div class="empty-state compact"><div><i class="fa-solid fa-lightbulb"></i><p>Insights aparecerão conforme você usar o FinSight.</p></div></div>`
            }
          </div>
        </section>
      </section>

      <p class="dashboard-generated-at item-meta">
        Atualizado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
          new Date(meta.generatedAt || Date.now()),
        )}
      </p>
    </section>
  `;
}

export function mountGeneralDashboardCharts(data) {
  const monthlyFlow = data?.charts?.monthlyFlow || [];
  const categoryDistribution = data?.charts?.categoryDistribution || [];

  const flowEl = document.querySelector("#dashboard-flow-chart");
  const categoryEl = document.querySelector("#dashboard-category-chart");

  if (flowEl && monthlyFlow.length) {
    mountChart(flowEl, chartService.mixedFlowChart(monthlyFlow));
  } else if (flowEl) {
    flowEl.innerHTML = `<div class="home-flow-empty">Sem movimentações suficientes para o gráfico.</div>`;
  }

  if (categoryEl && categoryDistribution.length) {
    mountChart(categoryEl, chartService.donutChart(categoryDistribution));
  } else if (categoryEl) {
    categoryEl.innerHTML = `<div class="home-flow-empty">Sem despesas por categoria no período.</div>`;
  }
}
