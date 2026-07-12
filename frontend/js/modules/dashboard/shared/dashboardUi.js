import { formatBRL } from "../../../services/chartService.js";

const ICON_ALIASES = {
  car: "fa-car",
  heart: "fa-heart",
  gamepad: "fa-gamepad",
  "book-open": "fa-book-open",
  repeat: "fa-repeat",
  wallet: "fa-wallet",
  "file-invoice-dollar": "fa-file-invoice-dollar",
};

function resolveFaIcon(rawIcon, fallback = "fa-wallet") {
  if (!rawIcon) return fallback;
  const value = String(rawIcon).trim();
  if (value.startsWith("fa-")) return value;
  return ICON_ALIASES[value] || `fa-${value}`;
}

function toneClass(tone) {
  if (tone === "positive") return "health-score-positive";
  if (tone === "warning") return "health-score-warning";
  return "health-score-neutral";
}

export function renderHealthScore(healthScore = {}) {
  const value = Number(healthScore.value) || 0;
  const tone = healthScore.tone || "neutral";
  const factors = healthScore.factors || [];
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (value / 100) * circumference;

  return `
    <section class="premium-card health-score-card">
      <div class="health-score-head">
        <div>
          <h2>Saúde financeira</h2>
          <p class="item-meta">Indicador consolidado de 0 a 100</p>
        </div>
        <span class="health-score-badge ${toneClass(tone)}">${value}/100</span>
      </div>
      <div class="health-score-body">
        <div class="health-score-ring ${toneClass(tone)}" aria-hidden="true">
          <svg viewBox="0 0 120 120" role="img" aria-label="Saúde financeira ${value} de 100">
            <circle class="health-score-track" cx="60" cy="60" r="54"></circle>
            <circle
              class="health-score-progress"
              cx="60"
              cy="60"
              r="54"
              style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};"
            ></circle>
          </svg>
          <strong class="health-score-value">${value}</strong>
        </div>
        <div class="health-score-factors">
          ${
            factors.length
              ? factors
                  .map(
                    (factor) => `
                <div class="health-score-factor">
                  <div class="health-score-factor-head">
                    <span>${factor.label}</span>
                    <strong>${Math.round(factor.score)}/${factor.weight}</strong>
                  </div>
                  <div class="progress-bar health-score-bar">
                    <div
                      class="progress"
                      style="--progress-width: ${Math.min((factor.score / factor.weight) * 100, 100)}%"
                    ></div>
                  </div>
                  <small class="item-meta">${factor.detail}</small>
                </div>
              `,
                  )
                  .join("")
              : `<p class="item-meta">Sem dados suficientes para calcular os fatores.</p>`
          }
        </div>
      </div>
    </section>
  `;
}

export function renderMetricCard(label, value, icon, caption, tone = "brand", trend = null) {
  const toneClass =
    tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "text-brand";

  const trendHtml = trend ? renderTrendBadge(trend, tone) : "";

  return `
    <article class="metric-card">
      <div class="metric-top">
        <span>${label}</span>
        <span class="metric-icon ${toneClass}"><i class="fa-solid ${icon}"></i></span>
      </div>
      <strong class="metric-value">${value}</strong>
      <small class="metric-caption">${caption}</small>
      ${trendHtml}
    </article>
  `;
}

function renderTrendBadge(trend, tone = "brand") {
  const invertTone = tone === "expense";
  let direction = trend.direction || "neutral";

  if (invertTone) {
    if (direction === "up") direction = "down";
    else if (direction === "down") direction = "up";
  }

  const icon =
    direction === "up"
      ? "fa-arrow-trend-up"
      : direction === "down"
        ? "fa-arrow-trend-down"
        : "fa-minus";

  const className =
    direction === "up"
      ? "metric-trend-up"
      : direction === "down"
        ? "metric-trend-down"
        : "metric-trend-neutral";

  return `
    <span class="metric-trend ${className}">
      <i class="fa-solid ${icon}"></i>
      ${trend.label || "Sem variação"}
    </span>
  `;
}

export function renderBillRow(bill) {
  const dueDate = bill.dueDate
    ? new Intl.DateTimeFormat("pt-BR").format(
        new Date(`${String(bill.dueDate).slice(0, 10)}T00:00:00`),
      )
    : "Sem prazo";

  return `
    <a class="list-item dashboard-bill-item" href="#contas-despesas">
      <div class="item-left">
        <span class="item-icon"><i class="fa-solid ${resolveFaIcon(bill.icon, "fa-file-invoice-dollar")}"></i></span>
        <div>
          <p class="item-title">${bill.name}</p>
          <p class="item-meta">${bill.category} · Vence ${dueDate}</p>
        </div>
      </div>
      <strong class="amount-negative">${formatBRL(bill.value)}</strong>
    </a>
  `;
}

export function renderMovementRow(transaction) {
  const amountClass = transaction.value >= 0 ? "amount-positive" : "amount-negative";
  const date = transaction.date
    ? new Intl.DateTimeFormat("pt-BR").format(
        new Date(`${String(transaction.date).slice(0, 10)}T00:00:00`),
      )
    : "";

  return `
    <div class="list-item home-transaction-item">
      <div class="item-left">
        <span class="item-icon"><i class="fa-solid ${resolveFaIcon(transaction.icon)}"></i></span>
        <div>
          <p class="item-title">${transaction.description}</p>
          <p class="item-meta">${transaction.category} · ${transaction.account}</p>
        </div>
      </div>
      <div class="home-transaction-side">
        <strong class="${amountClass}">${formatBRL(transaction.value)}</strong>
        <small class="item-meta">${date}</small>
      </div>
    </div>
  `;
}

export function renderInsightItem(insight) {
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

export function renderFlowSummaryItem(label, title, meta) {
  return `
    <div class="home-flow-summary-item">
      <span class="home-flow-summary-label">${label}</span>
      <strong class="home-flow-summary-title">${title}</strong>
      <small class="home-flow-summary-meta">${meta}</small>
    </div>
  `;
}
