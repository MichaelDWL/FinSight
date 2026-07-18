import { chartService } from "../../../services/chartService.js";
import { mountChart } from "../../../components/charts/ChartWrapper.js";
import { renderPeriodFilter } from "../shared/PeriodFilter.js";
import { renderDashboardNav } from "../shared/DashboardNav.js";
import { periodLabel } from "../shared/periodLabels.js";
import {
  renderOrderedMetrics,
  renderHealthScore,
  renderBillRow,
  renderMovementRow,
  renderInsightItem,
  renderFlowSummaryItem,
  profileBadge,
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
  const kpiOrder = data?.kpiOrder || [];
  const personalization = data?.personalization || meta.personalization || null;

  const topExpense = flowSummary.topExpenseCategory;
  const growingCategory = flowSummary.fastestGrowingCategory;

  const label = periodLabel(period);

  const metricCatalog = {
    balance: {
      label: "Saldo disponível",
      value: chartService.formatBRL(kpis.balance),
      icon: "fa-wallet",
      caption: "Disponível nas suas contas",
      tone: "brand",
      trend: trends.balance,
    },
    income: {
      label: "Receitas",
      value: chartService.formatBRL(kpis.income),
      icon: "fa-arrow-trend-up",
      caption: `Entradas no ${label}`,
      tone: "income",
      trend: trends.income,
    },
    expenses: {
      label: "Despesas",
      value: chartService.formatBRL(kpis.expenses),
      icon: "fa-arrow-trend-down",
      caption: `Gastos no ${label}`,
      tone: "expense",
      trend: trends.expenses,
    },
    netWorth: {
      label: "Patrimônio",
      value: chartService.formatBRL(kpis.netWorth),
      icon: "fa-gem",
      caption: "Contas + investimentos",
      tone: "brand",
      trend: trends.netWorth,
    },
    investments: {
      label: "Investimentos",
      value: chartService.formatBRL(kpis.investments),
      icon: "fa-chart-line",
      caption: "Carteira atual",
      tone: "income",
    },
    pendingBills: {
      label: "Contas pendentes",
      value: chartService.formatBRL(kpis.pendingBills),
      icon: "fa-file-invoice-dollar",
      caption: "A vencer",
      tone: "warning",
    },
  };

  return `
    <section class="app-page dashboard-page home-page">
      <div class="page-hero home-hero dashboard-hero">
        <div>
          <span class="page-eyebrow">Dashboard Geral</span>
          <h1 class="page-title home-greeting">Olá, ${firstName} 👋</h1>
          <p class="page-subtitle home-subtitle">
            Visão executiva do seu financeiro · ${label}
            ${profileBadge(personalization)}
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

      ${renderDashboardNav("dashboards/geral")}
      ${renderPeriodFilter(period)}

      <section class="home-section">
        <div class="metrics-grid home-metrics dashboard-metrics">
          ${renderOrderedMetrics(metricCatalog, kpiOrder, kpis)}
        </div>
      </section>

      <section class="home-section">
        ${renderHealthScore(healthScore)}
      </section>

      <section class="home-section">
        <div class="home-section-head">
          <h2>Evolução da saúde financeira</h2>
          <span class="home-section-meta">Histórico automático</span>
        </div>
        <section class="chart-card">
          <div id="dashboard-health-history-chart" class="dashboard-chart-host" data-chart="health-history"></div>
        </section>
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
            ${profileBadge(personalization) || '<span class="pill">Personalizado</span>'}
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
  const healthHistory =
    data?.healthHistory?.sixMonths ||
    data?.healthHistory?.year ||
    [];

  const flowEl = document.querySelector("#dashboard-flow-chart");
  const categoryEl = document.querySelector("#dashboard-category-chart");
  const healthEl = document.querySelector("#dashboard-health-history-chart");

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

  if (healthEl) {
    if (healthHistory.length) {
      const categories = healthHistory.map((item) => {
        const date = new Date(`${String(item.date).slice(0, 10)}T00:00:00`);
        return new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "short",
        }).format(date);
      });
      mountChart(
        healthEl,
        {
          ...chartService.areaChart({
            categories,
            series: [
              {
                name: "Saúde financeira",
                data: healthHistory.map((item) => Number(item.score) || 0),
              },
            ],
            height: 260,
          }),
          yaxis: {
            min: 0,
            max: 100,
            labels: { formatter: (value) => `${Math.round(value)}` },
          },
          tooltip: {
            y: { formatter: (value) => `${Math.round(value)} pts` },
          },
        },
      );
    } else {
      healthEl.innerHTML = `<div class="home-flow-empty">O histórico começa após o onboarding e o uso diário do FinSight.</div>`;
    }
  }
}
