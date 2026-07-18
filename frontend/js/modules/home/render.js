import { formatCurrency } from "../../utils/currency.js";
import { formatDateLabel } from "../../utils/dates.js";
import { metricCard } from "../../components/metric/metricCard.js";

function healthChip(item) {
  const toneClass =
    item.tone === "warning"
      ? "health-chip-warning"
      : item.tone === "positive"
        ? "health-chip-positive"
        : "";

  return `
    <a class="health-chip ${toneClass}" href="${item.href}">
      <span class="health-chip-icon"><i class="fa-solid ${item.icon}"></i></span>
      <div class="health-chip-body">
        <span class="health-chip-label">${item.label}</span>
        <strong class="health-chip-value">${item.value}</strong>
        <small class="health-chip-meta">${item.meta}</small>
      </div>
    </a>
  `;
}

function homeFlowChart(monthlyFlow = []) {
  if (!monthlyFlow.length) {
    return `<div class="home-flow-empty">Sem movimentações suficientes para o gráfico.</div>`;
  }

  const peak = Math.max(
    ...monthlyFlow.flatMap((month) => [
      Number(month.income) || 0,
      Number(month.expenses) || 0,
      Math.abs(Number(month.balance) || 0),
    ]),
    1,
  );

  const monthLabel = (label) => {
    const map = {
      Jan: "Jan",
      Feb: "Fev",
      Mar: "Mar",
      Apr: "Abr",
      May: "Mai",
      Jun: "Jun",
      Jul: "Jul",
      Aug: "Ago",
      Sep: "Set",
      Oct: "Out",
      Nov: "Nov",
      Dec: "Dez",
    };
    return map[String(label || "").slice(0, 3)] || label;
  };

  return `
    <div class="home-flow-chart" aria-label="Fluxo financeiro dos últimos 6 meses">
      <div class="home-flow-legend">
        <span><i class="legend-income"></i> Entradas</span>
        <span><i class="legend-expense"></i> Saídas</span>
        <span><i class="legend-balance"></i> Saldo</span>
      </div>
      <div class="home-flow-bars">
        ${monthlyFlow
          .map((month) => {
            const incomeHeight = Math.max(
              Math.round(((Number(month.income) || 0) / peak) * 100),
              6,
            );
            const expenseHeight = Math.max(
              Math.round(((Number(month.expenses) || 0) / peak) * 100),
              6,
            );
            const balanceHeight = Math.max(
              Math.round((Math.abs(Number(month.balance) || 0) / peak) * 100),
              6,
            );

            return `
              <div class="home-flow-month">
                <div class="home-flow-group">
                  <span class="home-flow-bar income" style="height: ${incomeHeight}%"></span>
                  <span class="home-flow-bar expense" style="height: ${expenseHeight}%"></span>
                  <span class="home-flow-bar balance" style="height: ${balanceHeight}%"></span>
                </div>
                <small>${monthLabel(month.month)}</small>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function homeFlowSummaryItem(label, title, meta) {
  return `
    <div class="home-flow-summary-item">
      <span class="home-flow-summary-label">${label}</span>
      <strong class="home-flow-summary-title">${title}</strong>
      <small class="home-flow-summary-meta">${meta}</small>
    </div>
  `;
}

function homeTransactionRow(transaction) {
  const amountClass =
    transaction.value >= 0 ? "amount-positive" : "amount-negative";
  const status = String(transaction.status || "confirmada").toLowerCase();
  const statusMeta =
    status === "pendente"
      ? { label: "Pendente", className: "status-pending", icon: "fa-hourglass-half" }
      : { label: "Confirmada", className: "status-paid", icon: "fa-circle-check" };

  return `
    <div class="list-item home-transaction-item">
      <div class="item-left">
        <span class="item-icon"><i class="fa-solid ${transaction.icon}"></i></span>
        <div>
          <p class="item-title">${transaction.description}</p>
          <p class="item-meta">${transaction.category} · ${transaction.account}</p>
        </div>
      </div>
      <div class="home-transaction-side">
        <strong class="${amountClass}">${formatCurrency(transaction.value)}</strong>
        <small class="item-meta">${formatDateLabel(transaction.date)}</small>
        <span class="status-pill ${statusMeta.className}">
          <i class="fa-solid ${statusMeta.icon}"></i>${statusMeta.label}
        </span>
      </div>
    </div>
  `;
}

function wealthMiniCard(label, value, icon, href) {
  return `
    <a class="wealth-mini-card" href="${href}">
      <span class="wealth-mini-icon"><i class="fa-solid ${icon}"></i></span>
      <div>
        <span class="wealth-mini-label">${label}</span>
        <strong class="wealth-mini-value">${formatCurrency(value)}</strong>
      </div>
    </a>
  `;
}

function homeInsightItem(insight) {
  const toneClass =
    insight.tone === "warning"
      ? "text-warning"
      : insight.tone === "positive"
        ? "text-income"
        : "text-brand";

  return `
    <div class="list-item insight-soft home-insight-item">
      <div class="item-left">
        <span class="item-icon ${toneClass}"><i class="fa-solid ${insight.icon}"></i></span>
        <p class="item-title">${insight.text}</p>
      </div>
    </div>
  `;
}

function progressPercent(goal) {
  if (!goal.desired) return 0;
  return Math.min(Math.round((goal.current / goal.desired) * 100), 100);
}

function goalCard(goal) {
  const percent = progressPercent(goal);

  return `
    <article class="goal-card">
      <div class="goal-head">
        <div>
          <h3 class="item-title">${goal.name}</h3>
          <p class="item-meta">Previsão: ${goal.date}</p>
        </div>
        <span class="pill">${percent}%</span>
      </div>
      <div>
        <div class="progress-bar">
          <div class="progress" style="--progress-width: ${percent}%"></div>
        </div>
        <p class="item-meta">${formatCurrency(goal.current)} de ${formatCurrency(goal.desired)}</p>
      </div>
    </article>
  `;
}

function getNearestGoals(goals, limit = 3) {
  return [...goals]
    .sort((first, second) => {
      if (first.deadline && second.deadline) {
        return String(first.deadline).localeCompare(String(second.deadline));
      }
      return progressPercent(second) - progressPercent(first);
    })
    .slice(0, limit);
}

function budgetProgressCard(item) {
  const tone =
    item.status === "exceeded"
      ? "expense"
      : item.status === "warning"
        ? "warning"
        : "brand";
  return `
    <article class="goal-card home-budget-card">
      <div class="goal-head">
        <div>
          <h3 class="item-title">${item.label}</h3>
          <p class="item-meta">${formatCurrency(item.used)} de ${formatCurrency(item.limit)}</p>
        </div>
        <span class="pill">${item.usagePercent || 0}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress progress-${tone}" style="--progress-width: ${Math.min(item.usagePercent || 0, 100)}%"></div>
      </div>
      <p class="item-meta">Ainda pode usar ${formatCurrency(item.remaining || 0)}</p>
    </article>
  `;
}

function spotlightCard(item) {
  if (!item) return "";
  const message = item.message || item.title || "";
  const href = item.route || "#dashboards/geral";
  return `
    <section class="home-section">
      <a class="premium-card home-spotlight" href="${href}">
        <div class="home-spotlight-copy">
          <span class="page-eyebrow">Prioridade agora</span>
          <strong class="item-title">${message}</strong>
          <p class="item-meta">${item.action || "Toque para ver detalhes"}</p>
        </div>
        <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
      </a>
    </section>
  `;
}

function orderedMetricCards({ balance, income, expenses, netWorth, trends, kpiOrder, investmentsTotal }) {
  const catalog = {
    balance: () =>
      metricCard(
        "Saldo disponível",
        formatCurrency(balance),
        "fa-wallet",
        "Disponível nas suas contas",
        "brand",
        trends.balance,
      ),
    income: () =>
      metricCard(
        "Receitas do mês",
        formatCurrency(income),
        "fa-arrow-trend-up",
        "Entradas recebidas neste mês",
        "income",
        trends.income,
      ),
    expenses: () =>
      metricCard(
        "Despesas do mês",
        formatCurrency(expenses),
        "fa-arrow-trend-down",
        "Total gasto neste mês",
        "expense",
        trends.expenses,
      ),
    netWorth: () =>
      metricCard(
        "Patrimônio",
        formatCurrency(netWorth),
        "fa-gem",
        "Contas + investimentos",
        "brand",
        trends.netWorth,
      ),
    investments: () =>
      metricCard(
        "Investimentos",
        formatCurrency(investmentsTotal),
        "fa-chart-line",
        "Valor atual da carteira",
        "income",
        null,
      ),
  };

  const order = (kpiOrder || ["balance", "income", "expenses", "netWorth"]).filter(
    (key) => catalog[key],
  );
  const unique = [...new Set(order.length ? order : ["balance", "income", "expenses", "netWorth"])];
  return unique.slice(0, 4).map((key) => catalog[key]()).join("");
}

export function render({
  dashboardData = {},
  transactions = [],
  investments = [],
  creditCards = [],
  goals = [],
  firstName = "Usuário",
}) {
  const balance = Number(dashboardData.balance || 0);
  const income = Number(dashboardData.income || 0);
  const expenses = Number(dashboardData.expenses || 0);
  const netWorth = Number(dashboardData.netWorth || 0);
  const trends = dashboardData.trends || {};
  const monthlyFlow = dashboardData.monthlyFlow || [];
  const flowSummary = dashboardData.flowSummary || {};
  const financialHealth = dashboardData.financialHealth || [];
  const wealthBreakdown = dashboardData.wealthBreakdown || {};
  const insights = dashboardData.insights || [];
  const personalization = dashboardData.personalization || null;
  const progress = dashboardData.progress || personalization?.progress || [];
  const healthScore = dashboardData.healthScore || personalization?.health || null;
  const spotlight =
    personalization?.home?.spotlight ||
    dashboardData.alerts?.[0] ||
    dashboardData.recommendations?.[0] ||
    null;
  const profileTitle = personalization?.profile?.title || null;
  const kpiOrder =
    personalization?.dashboards?.general?.kpiOrder ||
    personalization?.home?.priority ||
    [];
  const nearestGoals = getNearestGoals(goals, 3);
  const investmentsTotal =
    wealthBreakdown.investments ??
    investments.reduce((sum, item) => sum + Number(item.current || 0), 0);

  const topExpense = flowSummary.topExpenseCategory;
  const growingCategory = flowSummary.fastestGrowingCategory;
  const topIncome = flowSummary.topIncome;

  return `
    <section class="app-page home-page">
      <div class="page-hero home-hero">
        <div>
          <h1 class="page-title home-greeting">Olá, ${firstName} 👋</h1>
          <p class="page-subtitle home-subtitle">
            ${
              profileTitle
                ? `Seu FinSight está no modo <strong>${profileTitle}</strong> — priorizamos o que importa para você.`
                : "Veja rapidamente como está sua vida financeira hoje."
            }
          </p>
        </div>
        <div class="hero-actions">
          <button class="btn-primary" type="button" data-action="add-transaction"><i class="fa-solid fa-plus"></i> Nova Movimentação</button>
          <a class="btn-secondary" href="#dashboards/geral"><i class="fa-solid fa-chart-pie"></i> Ver dashboards</a>
        </div>
      </div>

      ${spotlightCard(spotlight)}

      <section class="home-section">
        <div class="metrics-grid home-metrics">
          ${orderedMetricCards({
            balance,
            income,
            expenses,
            netWorth,
            trends,
            kpiOrder,
            investmentsTotal,
          })}
        </div>
      </section>

      ${
        healthScore
          ? `
        <section class="home-section">
          <div class="home-section-head">
            <h2>Saúde financeira</h2>
            <span class="pill">${Math.round(healthScore.score)} · ${healthScore.label || ""}</span>
          </div>
          <div class="health-strip">
            ${(healthScore.factors || [])
              .slice(0, 4)
              .map(
                (factor) => `
              <button class="health-chip" type="button">
                <strong>${factor.label}</strong>
                <span>${Math.round(factor.score)}/${factor.weight}</span>
              </button>
            `,
              )
              .join("")}
          </div>
        </section>
      `
          : financialHealth.length
            ? `
        <section class="home-section">
          <div class="home-section-head">
            <h2>Saúde financeira</h2>
          </div>
          <div class="health-strip">${financialHealth.map(healthChip).join("")}</div>
        </section>
      `
            : ""
      }

      ${
        progress.length
          ? `
        <section class="home-section">
          <div class="home-section-head">
            <h2>Progresso do mês</h2>
            <span class="home-section-meta">Limites personalizados</span>
          </div>
          <div class="home-budget-grid">
            ${progress.map(budgetProgressCard).join("")}
          </div>
        </section>
      `
          : ""
      }

      <section class="home-section">
        <div class="home-section-head">
          <h2>Fluxo financeiro</h2>
          <span class="home-section-meta">Últimos 6 meses</span>
        </div>
        <div class="home-flow-grid">
          <section class="chart-card home-flow-card">
            ${homeFlowChart(monthlyFlow)}
          </section>
          <section class="premium-card home-flow-summary">
            ${homeFlowSummaryItem(
              "Maior categoria de gastos",
              topExpense?.name || "Sem gastos no mês",
              topExpense ? formatCurrency(topExpense.value) : "Cadastre movimentações para ver",
            )}
            ${homeFlowSummaryItem(
              "Categoria que mais cresceu",
              growingCategory?.name || "Nenhuma alta relevante",
              growingCategory
                ? `+${growingCategory.growth}% · ${formatCurrency(growingCategory.value)}`
                : "Comparado ao mês anterior",
            )}
            ${homeFlowSummaryItem(
              "Maior receita do mês",
              topIncome?.name || "Sem receitas no mês",
              topIncome
                ? `${topIncome.category} · ${formatCurrency(topIncome.value)}`
                : "Cadastre entradas para ver",
            )}
          </section>
        </div>
      </section>

      <section class="home-section">
        <section class="premium-card">
          <div class="card-title-row">
            <h2>Movimentações recentes</h2>
            <a class="btn-secondary" href="#transacoes">Ver todas</a>
          </div>
          <div class="mini-list">
            ${
              transactions.length
                ? transactions.slice(0, 5).map(homeTransactionRow).join("")
                : `<div class="empty-state compact"><div><i class="fa-solid fa-receipt"></i><p>Nenhuma movimentação registrada ainda.</p></div></div>`
            }
          </div>
        </section>
      </section>

      <section class="home-section">
        <div class="home-section-head">
          <h2>Patrimônio</h2>
          <a class="home-section-link" href="#patrimonio">Ver detalhes</a>
        </div>
        <div class="wealth-mini-grid">
          ${wealthMiniCard("Contas", wealthBreakdown.accounts ?? balance, "fa-building-columns", "#contas-bancos")}
          ${wealthMiniCard("Investimentos", investmentsTotal, "fa-chart-line", "#patrimonio")}
          ${wealthMiniCard("Dinheiro", wealthBreakdown.cash ?? 0, "fa-money-bill-wave", "#contas-bancos")}
          ${wealthMiniCard("Cartões", wealthBreakdown.cardsAvailable ?? creditCards.reduce((sum, card) => sum + (card.totalLimit - card.usedLimit), 0), "fa-credit-card", "#contas-cartoes")}
        </div>
      </section>

      <section class="home-section home-bottom-grid">
        <section class="premium-card">
          <div class="card-title-row">
            <h2>Metas financeiras</h2>
            <a class="btn-secondary" href="#metas">Ver todas</a>
          </div>
          <div class="mini-list">
            ${
              nearestGoals.length
                ? nearestGoals.map(goalCard).join("")
                : `<div class="empty-state compact"><div><i class="fa-solid fa-bullseye"></i><p>Cadastre metas para acompanhar seu progresso.</p></div></div>`
            }
          </div>
        </section>

        <section class="premium-card">
          <div class="card-title-row">
            <h2>Insights inteligentes</h2>
            <span class="pill">${profileTitle ? profileTitle : "Personalizado"}</span>
          </div>
          <div class="mini-list">
            ${
              insights.length
                ? insights.map(homeInsightItem).join("")
                : `<div class="empty-state compact"><div><i class="fa-solid fa-lightbulb"></i><p>Insights aparecerão conforme você usar o FinSight.</p></div></div>`
            }
          </div>
        </section>
      </section>
    </section>
  `;
}

export { render as renderHomeDashboard };
