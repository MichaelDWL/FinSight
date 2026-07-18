const FIXED_INCOME_TYPES = new Set([
  "tesouro_selic",
  "tesouro_ipca",
  "tesouro_prefixado",
  "cdb",
  "lci",
  "lca",
  "poupanca",
]);

const VARIABLE_TYPES = new Set(["acoes", "fiis", "etfs", "criptomoedas"]);

export const INVESTMENT_TYPE_OPTIONS = [
  { value: "tesouro_selic", label: "Tesouro Selic" },
  { value: "tesouro_ipca", label: "Tesouro IPCA+" },
  { value: "tesouro_prefixado", label: "Tesouro Prefixado" },
  { value: "cdb", label: "CDB" },
  { value: "lci", label: "LCI" },
  { value: "lca", label: "LCA" },
  { value: "poupanca", label: "Poupança" },
  { value: "acoes", label: "Ações" },
  { value: "fiis", label: "FIIs" },
  { value: "etfs", label: "ETFs" },
  { value: "criptomoedas", label: "Criptomoedas" },
  { value: "fundos", label: "Fundos" },
  { value: "outro", label: "Outro" },
];

export function isFixedIncomeType(type) {
  return FIXED_INCOME_TYPES.has(type);
}

export function isVariableIncomeType(type) {
  return VARIABLE_TYPES.has(type);
}

export function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);
}

export function formatPercent(value) {
  const num = Number(value) || 0;
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

export function formatRate(value, suffix = "% a.a.") {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toFixed(2)}${suffix}`;
}

function toggleField(el, visible) {
  if (!el) return;
  el.hidden = !visible;
  el.classList.toggle("is-hidden", !visible);
  el.querySelectorAll("input, select, textarea").forEach((input) => {
    input.disabled = !visible;
    if (!visible) input.removeAttribute("required");
  });
}

export function syncInvestmentFormFields(form) {
  if (!form) return;

  const type = form.querySelector("#investmentType")?.value || "outro";
  const cdiField = form.querySelector("[data-field='cdiPercent']");
  const prefixedField = form.querySelector("[data-field='prefixedRate']");
  const ipcaField = form.querySelector("[data-field='ipcaSpread']");
  const assetField = form.querySelector("[data-field='assetCode']");
  const quantityField = form.querySelector("[data-field='quantity']");
  const projectionPanel = form.querySelector("#investmentProjectionPanel");

  const showCdi = ["cdb", "lci", "lca"].includes(type);
  const showPrefixed = type === "tesouro_prefixado";
  const showIpca = type === "tesouro_ipca";
  const showAsset = isVariableIncomeType(type);

  toggleField(cdiField, showCdi);
  toggleField(prefixedField, showPrefixed);
  toggleField(ipcaField, showIpca);
  toggleField(assetField, showAsset);
  toggleField(quantityField, showAsset);

  if (projectionPanel) {
    const showProjection = isFixedIncomeType(type);
    projectionPanel.hidden = !showProjection;
    projectionPanel.classList.toggle("is-hidden", !showProjection);
  }
}

export function buildSimulationPayload(form) {
  const formData = new FormData(form);
  const type = String(formData.get("investmentType") || "outro");
  const invested = Number(formData.get("invested")) || 0;

  const payload = {
    invested,
    investmentType: type,
  };

  if (["cdb", "lci", "lca"].includes(type)) {
    const cdi = Number(formData.get("cdiPercent"));
    payload.cdiPercent = Number.isFinite(cdi) ? cdi : 100;
  }

  if (type === "tesouro_prefixado") {
    const rate = Number(formData.get("prefixedRate"));
    if (Number.isFinite(rate)) payload.prefixedRate = rate;
  }

  if (type === "tesouro_ipca") {
    const spread = Number(formData.get("ipcaSpread"));
    if (Number.isFinite(spread)) payload.ipcaSpread = spread;
  }

  return payload;
}

export function buildInvestmentPayload(form) {
  const formData = new FormData(form);
  const invested = Number(formData.get("invested")) || 0;
  const current = Number(formData.get("current")) || invested;
  const type = String(formData.get("investmentType") || "outro");
  const assetCode = String(formData.get("assetCode") || "").trim().toUpperCase();

  const payload = {
    name: formData.get("name") || "Novo investimento",
    institution: formData.get("institution") || null,
    invested,
    value: current,
    date: formData.get("date") || new Date().toISOString().slice(0, 10),
    notes: formData.get("notes") || null,
    investmentType: type,
  };

  if (["cdb", "lci", "lca"].includes(type)) {
    const cdi = Number(formData.get("cdiPercent"));
    payload.cdiPercent = Number.isFinite(cdi) ? cdi : 100;
  }

  if (type === "tesouro_prefixado") {
    const rate = Number(formData.get("prefixedRate"));
    if (Number.isFinite(rate)) payload.prefixedRate = rate;
  }

  if (type === "tesouro_ipca") {
    const spread = Number(formData.get("ipcaSpread"));
    if (Number.isFinite(spread)) payload.ipcaSpread = spread;
  }

  if (isVariableIncomeType(type) && assetCode) {
    payload.assetCode = assetCode;
    const quantity = Number(formData.get("quantity"));
    if (Number.isFinite(quantity) && quantity > 0) {
      payload.quantity = quantity;
    }
  }

  return payload;
}

export function renderProjectionPanel(simulation) {
  if (!simulation || simulation.kind === "variable_income") {
    return `
      <div class="investment-projection-empty">
        <p class="font-small">Projeções automáticas estão disponíveis apenas para renda fixa.</p>
      </div>
    `;
  }

  const horizons = simulation.horizons || [];
  const rows = horizons
    .map(
      (item) => `
      <div class="projection-horizon">
        <span class="font-label">${item.label}</span>
        <strong>${formatMoney(item.estimatedWealth)}</strong>
        <small class="item-meta">${formatPercent(item.returnPercent)} · lucro ${formatMoney(item.estimatedProfit)}</small>
      </div>
    `,
    )
    .join("");

  return `
    <div class="investment-projection-head">
      <div>
        <span class="font-label">Simulação</span>
        <p class="font-small">Taxa estimada ${formatRate(simulation.annualRate)}</p>
      </div>
    </div>
    <div class="projection-horizons">${rows}</div>
    <p class="investment-projection-disclaimer font-small">${simulation.disclaimer || ""}</p>
  `;
}

export function renderEconomicRatesStrip(rates = {}) {
  const items = [
    { key: "selic", label: "SELIC", suffix: "% a.a." },
    { key: "cdi", label: "CDI", suffix: "% a.a." },
    { key: "ipca", label: "IPCA", suffix: "% m/m" },
    { key: "dolar", label: "Dólar", suffix: "", prefix: "R$ " },
    { key: "euro", label: "Euro", suffix: "", prefix: "R$ " },
  ];

  const cards = items
    .map((item) => {
      const value = rates[item.key];
      const display =
        value == null
          ? "—"
          : item.prefix
            ? `${item.prefix}${Number(value).toFixed(4)}`
            : formatRate(value, item.suffix);
      return `
        <div class="rate-chip">
          <span class="font-label">${item.label}</span>
          <strong>${display}</strong>
        </div>
      `;
    })
    .join("");

  const updated = rates.lastUpdate
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(rates.lastUpdate))
    : "—";

  return `
    <section class="premium-card economic-rates-card">
      <div class="card-title-row">
        <h2>Indicadores econômicos</h2>
        <span class="pill">${rates.stale ? "Desatualizado" : "Atualizado"} · ${updated}</span>
      </div>
      <div class="rates-strip">${cards}</div>
    </section>
  `;
}

export function renderPortfolioProjectionBlock(projection) {
  if (!projection?.horizons?.length) return "";

  const rows = projection.horizons
    .map(
      (item) => `
      <div class="list-item">
        <div class="item-left">
          <span class="item-icon"><i class="fa-solid fa-clock"></i></span>
          <div>
            <p class="item-title">${item.label}</p>
            <p class="item-meta">Rentabilidade ${formatPercent(item.returnPercent)}</p>
          </div>
        </div>
        <div class="home-transaction-side">
          <strong>${formatMoney(item.estimatedWealth)}</strong>
          <small class="item-meta">lucro ${formatMoney(item.estimatedProfit)}</small>
        </div>
      </div>
    `,
    )
    .join("");

  return `
    <section class="premium-card">
      <div class="card-title-row">
        <h2>Projeção da carteira</h2>
        <span class="pill">Estimativa</span>
      </div>
      <div class="mini-list">${rows}</div>
      <p class="investment-projection-disclaimer font-small">${projection.disclaimer || ""}</p>
    </section>
  `;
}

export function renderPortfolioHighlights(summary) {
  if (!summary?.kpis) return "";

  const { kpis, highlights, distribution = [] } = summary;
  const distRows = distribution
    .slice(0, 6)
    .map(
      (item) => `
      <div class="history-item">
        <span>${item.category} (${item.count})</span>
        <strong>${formatMoney(item.value)} · ${Number(item.percent || 0).toFixed(1)}%</strong>
      </div>
    `,
    )
    .join("");

  return `
    <section class="premium-card">
      <div class="card-title-row">
        <h2>Inteligência da carteira</h2>
        <span class="pill">${formatPercent(kpis.returnRate)}</span>
      </div>
      <div class="detail-stat-grid">
        <div class="detail-stat">
          <span class="font-label">Investido</span>
          <strong>${formatMoney(kpis.invested)}</strong>
        </div>
        <div class="detail-stat">
          <span class="font-label">Atual</span>
          <strong>${formatMoney(kpis.current)}</strong>
        </div>
        <div class="detail-stat">
          <span class="font-label">Lucro</span>
          <strong class="${kpis.profit >= 0 ? "text-income" : "text-expense"}">${formatMoney(kpis.profit)}</strong>
        </div>
        <div class="detail-stat">
          <span class="font-label">Ativos</span>
          <strong>${kpis.count || 0}</strong>
        </div>
      </div>
      <div class="mini-list patrimony-breakdown" style="margin-top:1rem">
        ${
          highlights?.largestPosition
            ? `<div class="history-item"><span>Maior posição</span><strong>${highlights.largestPosition.name}</strong></div>`
            : ""
        }
        ${
          highlights?.bestProfit
            ? `<div class="history-item"><span>Maior lucro</span><strong class="text-income">${highlights.bestProfit.name}</strong></div>`
            : ""
        }
        ${
          highlights?.worstProfit
            ? `<div class="history-item"><span>Maior prejuízo</span><strong class="text-expense">${highlights.worstProfit.name}</strong></div>`
            : ""
        }
        ${distRows}
      </div>
    </section>
  `;
}

export function renderVariableMarketBlock(simulation, investmentId) {
  const market = simulation?.market;
  if (!market) {
    return `
      <div class="investment-projection-empty">
        <p class="font-small">Cotação ainda não disponível no banco. O scheduler tentará atualizar automaticamente.</p>
      </div>
    `;
  }

  return `
    <div class="variable-market-block">
      <div class="detail-stat-grid">
        <div class="detail-stat"><span>Preço atual</span><strong>${formatMoney(market.currentPrice)}</strong></div>
        <div class="detail-stat"><span>Variação dia</span><strong>${formatPercent(market.dailyChange)}</strong></div>
        <div class="detail-stat"><span>Variação mês</span><strong>${formatPercent(market.monthlyChange)}</strong></div>
        <div class="detail-stat"><span>Variação ano</span><strong>${formatPercent(market.yearlyChange)}</strong></div>
        <div class="detail-stat"><span>Maior</span><strong>${formatMoney(market.stats?.maxPrice)}</strong></div>
        <div class="detail-stat"><span>Menor</span><strong>${formatMoney(market.stats?.minPrice)}</strong></div>
        <div class="detail-stat"><span>Volatilidade</span><strong>${market.stats?.volatility != null ? `${Number(market.stats.volatility).toFixed(2)}%` : "—"}</strong></div>
        <div class="detail-stat"><span>Atualizado</span><strong>${market.lastUpdate ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(market.lastUpdate)) : "—"}</strong></div>
      </div>
      <div id="market-chart-${investmentId}" class="dashboard-chart-host market-history-chart" data-chart="market-${investmentId}"></div>
      <p class="investment-projection-disclaimer font-small">${simulation.message || "Renda variável não possui previsão de preço futuro."}</p>
    </div>
  `;
}

export function renderFixedSimulationBlock(simulation) {
  if (!simulation?.horizons?.length) return "";
  return renderProjectionPanel(simulation);
}
