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

function dueLabel(days) {
  if (days === null || days === undefined) return "";
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days < 0) return `${Math.abs(days)}d atrasado`;
  return `Em ${days} dias`;
}

function renderCardLimitRow(card) {
  const tone =
    card.usagePercent >= 80 ? "warning" : card.usagePercent >= 50 ? "neutral" : "positive";

  return `
    <div class="list-item dashboard-card-limit-item">
      <div class="item-left">
        <span class="dashboard-card-dot" style="background:${card.color || "var(--brand-accent)"}"></span>
        <div>
          <p class="item-title">${card.name}</p>
          <p class="item-meta">${chartService.formatBRL(card.availableLimit)} disponível de ${chartService.formatBRL(card.totalLimit)}</p>
        </div>
      </div>
      <div class="dashboard-card-limit-side">
        <strong>${card.usagePercent}%</strong>
        <div class="progress-bar dashboard-limit-bar">
          <div class="progress dashboard-limit-progress ${tone}" style="--progress-width:${Math.min(card.usagePercent, 100)}%"></div>
        </div>
      </div>
    </div>
  `;
}

export function renderCardsDashboard(data, { period = "30d" } = {}) {
  const kpis = data?.kpis || {};
  const cards = data?.cards || [];
  const installments = data?.installments || {};
  const futureInstallments = data?.lists?.futureInstallments || [];
  const upcomingInvoices = data?.lists?.upcomingInvoices || [];
  const nextClosings = data?.lists?.nextClosings || [];
  const nextDueDates = data?.lists?.nextDueDates || [];
  const cardComparison = data?.charts?.cardComparison || [];
  const label = periodLabel(period);

  return `
    <section class="app-page dashboard-page">
      <div class="page-hero dashboard-hero">
        <div>
          <span class="page-eyebrow">Dashboard de Cartões</span>
          <h1 class="page-title">Crédito sob controle</h1>
          <p class="page-subtitle">Limites, faturas e parcelas em um só lugar · ${label}</p>
        </div>
        <div class="hero-actions">
          <a class="btn-secondary" href="#contas-cartoes">
            <i class="fa-solid fa-credit-card"></i> Gerenciar cartões
          </a>
        </div>
      </div>

      ${renderDashboardNav("dashboard/cartoes")}
      ${renderPeriodFilter(period)}

      <section class="home-section">
        <div class="metrics-grid dashboard-metrics">
          ${renderMetricCard(
            "Limite disponível",
            chartService.formatBRL(kpis.availableLimit),
            "fa-wallet",
            `De ${chartService.formatBRL(kpis.totalLimit)} total`,
            "brand",
          )}
          ${renderMetricCard(
            "Limite utilizado",
            `${kpis.usagePercent || 0}%`,
            "fa-chart-pie",
            chartService.formatBRL(kpis.usedLimit),
            kpis.usagePercent >= 70 ? "expense" : "brand",
          )}
          ${renderMetricCard(
            "Gastos no cartão",
            chartService.formatBRL(kpis.periodSpending),
            "fa-bag-shopping",
            `Compras no ${label}`,
            "expense",
          )}
          ${renderMetricCard(
            "Parcelas futuras",
            chartService.formatBRL(kpis.pendingInstallments),
            "fa-clock",
            `${kpis.pendingInstallmentsCount || 0} parcela(s) pendente(s)`,
            "brand",
          )}
        </div>
      </section>

      <section class="home-section dashboard-charts-grid">
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Uso do limite por cartão</h2>
          </div>
          <div id="cards-limit-chart" class="dashboard-chart-host" data-chart="cards-limit"></div>
        </section>
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Compras por categoria</h2>
            <span class="pill">${label}</span>
          </div>
          <div id="cards-category-chart" class="dashboard-chart-host" data-chart="cards-category"></div>
        </section>
      </section>

      <section class="home-section">
        <section class="chart-card">
          <div class="card-title-row">
            <h2>Evolução das faturas</h2>
            <span class="home-section-meta">Últimos 12 meses</span>
          </div>
          <div id="cards-invoice-chart" class="dashboard-chart-host" data-chart="cards-invoice"></div>
        </section>
      </section>

      <section class="home-section home-bottom-grid">
        <section class="premium-card">
          <div class="card-title-row">
            <h2>Comparativo entre cartões</h2>
          </div>
          <div class="mini-list">
            ${
              cardComparison.length
                ? cardComparison.map(renderCardLimitRow).join("")
                : `<div class="empty-state compact"><div><i class="fa-solid fa-credit-card"></i><p>Nenhum cartão cadastrado.</p></div></div>`
            }
          </div>
        </section>

        <section class="premium-card">
          <div class="card-title-row">
            <h2>Próximos fechamentos</h2>
          </div>
          <div class="mini-list">
            ${
              nextClosings.length
                ? nextClosings
                    .map(
                      (card) => `
                  <div class="list-item">
                    <div class="item-left">
                      <span class="dashboard-card-dot" style="background:${card.color}"></span>
                      <div>
                        <p class="item-title">${card.name}</p>
                        <p class="item-meta">Dia ${card.closingDay} · ${formatDate(card.nextClosing)}</p>
                      </div>
                    </div>
                    <span class="pill">${dueLabel(card.nextClosingDays)}</span>
                  </div>
                `,
                    )
                    .join("")
                : `<div class="empty-state compact"><div><i class="fa-solid fa-calendar"></i><p>Sem cartões com fechamento configurado.</p></div></div>`
            }
          </div>
        </section>
      </section>

      <section class="home-section home-bottom-grid">
        <section class="premium-card">
          <div class="card-title-row">
            <h2>Próximos vencimentos</h2>
          </div>
          <div class="mini-list">
            ${
              upcomingInvoices.length
                ? upcomingInvoices
                    .map(
                      (invoice) => `
                  <a class="list-item dashboard-bill-item" href="#contas-cartoes">
                    <div class="item-left">
                      <span class="dashboard-card-dot" style="background:${invoice.cardColor}"></span>
                      <div>
                        <p class="item-title">${invoice.cardName}</p>
                        <p class="item-meta">Vence ${formatDate(invoice.dueDate)} · ${invoice.status}</p>
                      </div>
                    </div>
                    <strong class="amount-negative">${chartService.formatBRL(invoice.total)}</strong>
                  </a>
                `,
                    )
                    .join("")
                : nextDueDates.length
                  ? nextDueDates
                      .map(
                        (card) => `
                    <div class="list-item">
                      <div class="item-left">
                        <span class="dashboard-card-dot" style="background:${card.color}"></span>
                        <div>
                          <p class="item-title">${card.name}</p>
                          <p class="item-meta">Vencimento dia ${card.dueDay} · ${formatDate(card.nextDue)}</p>
                        </div>
                      </div>
                      <span class="pill">${dueLabel(card.nextDueDays)}</span>
                    </div>
                  `,
                      )
                      .join("")
                  : `<div class="empty-state compact"><div><i class="fa-solid fa-calendar-check"></i><p>Nenhum vencimento próximo.</p></div></div>`
            }
          </div>
        </section>

        <section class="premium-card">
          <div class="card-title-row">
            <h2>Parcelas futuras</h2>
            <span class="pill">${installments.pendingCount || 0} pendente(s)</span>
          </div>
          <div class="mini-list">
            ${
              futureInstallments.length
                ? futureInstallments
                    .map(
                      (item) => `
                  <div class="list-item">
                    <div class="item-left">
                      <span class="item-icon text-brand"><i class="fa-solid fa-layer-group"></i></span>
                      <div>
                        <p class="item-title">${item.description}</p>
                        <p class="item-meta">${item.cardName || "Cartão"} · ${item.installment}/${item.total} · ${formatDate(item.dueDate)}</p>
                      </div>
                    </div>
                    <strong class="amount-negative">${chartService.formatBRL(item.value)}</strong>
                  </div>
                `,
                    )
                    .join("")
                : `<div class="empty-state compact"><div><i class="fa-solid fa-layer-group"></i><p>Sem parcelas futuras pendentes.</p></div></div>`
            }
          </div>
        </section>
      </section>
    </section>
  `;
}

export function mountCardsDashboardCharts(data) {
  const limitUsage = data?.charts?.limitUsage || [];
  const purchasesByCategory = data?.charts?.purchasesByCategory || [];
  const invoiceEvolution = data?.charts?.invoiceEvolution || [];
  const invoiceEvolutionByCard = data?.charts?.invoiceEvolutionByCard || [];

  const limitEl = document.querySelector("#cards-limit-chart");
  const categoryEl = document.querySelector("#cards-category-chart");
  const invoiceEl = document.querySelector("#cards-invoice-chart");

  if (limitEl && limitUsage.length) {
    mountChart(limitEl, chartService.limitUsageChart(limitUsage));
  } else if (limitEl) {
    limitEl.innerHTML = `<div class="home-flow-empty">Cadastre cartões para ver o uso de limite.</div>`;
  }

  if (categoryEl && purchasesByCategory.length) {
    mountChart(categoryEl, chartService.donutChart(purchasesByCategory));
  } else if (categoryEl) {
    categoryEl.innerHTML = `<div class="home-flow-empty">Sem compras no cartão no período.</div>`;
  }

  if (invoiceEl && invoiceEvolution.length) {
    mountChart(
      invoiceEl,
      chartService.invoiceEvolutionChart(invoiceEvolution, invoiceEvolutionByCard),
    );
  } else if (invoiceEl) {
    invoiceEl.innerHTML = `<div class="home-flow-empty">Sem histórico de faturas disponível.</div>`;
  }
}
