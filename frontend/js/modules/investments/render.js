import { formatCurrency } from "../../utils/currency.js";
import { metricCard } from "../../components/metric/metricCard.js";
import { mountChart } from "../../components/charts/ChartWrapper.js";
import { chartService } from "../../services/chartService.js";
import {
  renderEconomicRatesStrip,
  renderFixedSimulationBlock,
  renderPortfolioHighlights,
  renderPortfolioProjectionBlock,
  renderVariableMarketBlock,
} from "./form.js";

export function investmentCard(investment, compact = false) {
  return `
    <article class="investment-card">
      <div class="investment-head">
        <div class="item-left">
          <span class="investment-icon">${investment.icon}</span>
          <div>
            <h3 class="item-title">${investment.name}</h3>
            <p class="item-meta">${investment.category}</p>
          </div>
        </div>
        <span class="return-badge">+${investment.returnRate}%</span>
      </div>
      <strong class="investment-value">${formatCurrency(investment.current)}</strong>
      ${compact ? "" : `<p class="item-meta">${investment.institution} • investido em ${new Date(investment.date).toLocaleDateString("pt-BR")}</p>`}
      ${
        compact
          ? ""
          : `<div class="card-actions">
              <button class="btn-secondary" type="button" data-action="edit-investment" data-investment-id="${investment.id}">Editar</button>
            </div>`
      }
    </article>
  `;
}

export function renderWealth(accounts, investments, creditCards, portfolioSummary) {
  const cashTotal = accounts.reduce((sum, account) => sum + account.balance, 0);
  const investmentsTotal = investments.reduce(
    (sum, investment) => sum + investment.current,
    0,
  );
  const invested = investments.reduce(
    (sum, investment) => sum + investment.invested,
    0,
  );
  const availableCredit = creditCards.reduce(
    (sum, card) => sum + (card.totalLimit - card.usedLimit),
    0,
  );
  const usedCredit = creditCards.reduce((sum, card) => sum + card.usedLimit, 0);
  const totalPatrimony = cashTotal + investmentsTotal;
  const purchasePower = cashTotal + availableCredit;
  const rates = portfolioSummary?.rates || {};
  const intelligenceBlock = renderPortfolioHighlights(portfolioSummary);
  const projectionBlock = renderPortfolioProjectionBlock(
    portfolioSummary?.portfolioProjection,
  );

  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Patrimônio</span>
          <h1 class="page-title">Sua carteira financeira completa.</h1>
          <p class="page-subtitle">Acompanhe dinheiro em conta, reserva, limite disponível nos cartões e investimentos em uma visão única do seu patrimônio.</p>
        </div>
        <button class="btn-primary" type="button" data-action="add-investment"><i class="fa-solid fa-plus"></i> Adicionar investimento</button>
      </div>

      <div class="metrics-grid">
        ${metricCard("Patrimônio real", formatCurrency(totalPatrimony), "fa-gem", "Contas + investimentos")}
        ${metricCard("Dinheiro disponível", formatCurrency(cashTotal), "fa-wallet", "Saldo em contas e carteira", "income")}
        ${metricCard("Limite disponível", formatCurrency(availableCredit), "fa-credit-card", `${formatCurrency(usedCredit)} já utilizado`)}
        ${metricCard("Investimentos", formatCurrency(investmentsTotal), "fa-chart-line", `${investments.length} ativos acompanhados`)}
      </div>

      ${Object.keys(rates).length ? renderEconomicRatesStrip(rates) : ""}

      <div class="wealth-grid">
        <section class="premium-card">
          <div class="card-title-row">
            <h2>Dinheiro em contas</h2>
            <span class="pill">${formatCurrency(cashTotal)}</span>
          </div>
          <div class="financial-grid">
            ${accounts
              .map(
                (account) => `
                  <article class="financial-card">
                    <div class="investment-head">
                      <div class="item-left">
                        <span class="item-icon ${account.color}"><i class="fa-solid ${account.icon}"></i></span>
                        <div>
                          <h3 class="item-title">${account.name}</h3>
                          <p class="item-meta">${account.type}</p>
                        </div>
                      </div>
                    </div>
                    <strong class="investment-value">${formatCurrency(account.balance)}</strong>
                  </article>
                `,
              )
              .join("")}
          </div>
        </section>

        <section class="chart-card">
          <div class="card-title-row">
            <h2>Cartões de crédito</h2>
            <span class="pill">${formatCurrency(availableCredit)} livre</span>
          </div>
          <div class="mini-list">
            ${creditCards
              .map((card) => {
                const available = card.totalLimit - card.usedLimit;
                const usedPercent = Math.round(
                  (card.usedLimit / card.totalLimit) * 100,
                );

                return `
                  <article class="credit-card-summary">
                    <div class="card-title-row">
                      <div class="item-left">
                        <span class="item-icon"><i class="fa-solid ${card.icon}"></i></span>
                        <div>
                          <h3 class="item-title">${card.name}</h3>
                          <p class="item-meta">Fecha dia ${card.closingDay} • vence dia ${card.dueDay}</p>
                        </div>
                      </div>
                      <strong>${formatCurrency(available)}</strong>
                    </div>
                    <div class="progress-bar">
                      <div class="progress credit-progress" style="--progress-width: ${usedPercent}%"></div>
                    </div>
                    <p class="item-meta">${formatCurrency(card.usedLimit)} usado de ${formatCurrency(card.totalLimit)}</p>
                  </article>
                `;
              })
              .join("")}
          </div>
        </section>
      </div>

      <div class="wealth-grid">
        <section class="premium-card">
          <div class="card-title-row">
            <h2>Investimentos</h2>
            <span class="pill">${formatCurrency(investmentsTotal)}</span>
          </div>
          <div class="investments-grid">${investments.map((investment) => investmentCard(investment)).join("")}</div>
        </section>

        <section class="chart-card">
          <div class="card-title-row">
            <h2>Composição geral</h2>
            <span class="pill">${formatCurrency(totalPatrimony)}</span>
          </div>
          <div class="bar-chart">
            <span style="height: ${Math.max(Math.round((cashTotal / totalPatrimony) * 88), 18)}%" data-label="Contas"></span>
            <span style="height: ${Math.max(Math.round((investmentsTotal / totalPatrimony) * 88), 18)}%" data-label="Invest."></span>
            <span style="height: ${Math.max(Math.round((availableCredit / purchasePower) * 88), 18)}%" data-label="Limite"></span>
          </div>
          <div class="mini-list patrimony-breakdown">
            <div class="history-item"><span>Patrimônio real</span><strong>${formatCurrency(totalPatrimony)}</strong></div>
            <div class="history-item"><span>Poder de compra com limite</span><strong>${formatCurrency(purchasePower)}</strong></div>
            <div class="history-item"><span>Lucro nos investimentos</span><strong class="${investmentsTotal - invested >= 0 ? "text-income" : "text-expense"}">${formatCurrency(investmentsTotal - invested)}</strong></div>
          </div>
        </section>
      </div>

      ${
        intelligenceBlock || projectionBlock
          ? `<div class="wealth-grid">${intelligenceBlock}${projectionBlock}</div>`
          : ""
      }
    </section>
  `;
}

export function renderDetail(investments) {
  if (!investments.length) {
    return `
      <section class="app-page">
        <div class="page-hero">
          <div>
            <span class="page-eyebrow">Detalhes</span>
            <h1 class="page-title">Nenhum investimento encontrado.</h1>
            <p class="page-subtitle">Assim que os dados forem carregados da API, ou um novo investimento for cadastrado, os detalhes aparecerão aqui.</p>
          </div>
          <button class="btn-primary" type="button" data-action="add-investment"><i class="fa-solid fa-plus"></i> Novo investimento</button>
        </div>
      </section>
    `;
  }

  const totalCurrent = investments.reduce(
    (sum, investment) => sum + investment.current,
    0,
  );
  const totalInvested = investments.reduce(
    (sum, investment) => sum + investment.invested,
    0,
  );
  const totalProfit = totalCurrent - totalInvested;
  const averageReturn = investments.length
    ? Math.round(
        investments.reduce(
          (sum, investment) => sum + investment.returnRate,
          0,
        ) / investments.length,
      )
    : 0;
  const highestInvestment = investments.reduce(
    (highest, investment) =>
      investment.current > highest.current ? investment : highest,
    investments[0],
  );

  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Detalhes</span>
          <h1 class="page-title">Todos os investimentos em detalhes.</h1>
          <p class="page-subtitle">Projeções de renda fixa e indicadores de mercado para renda variável, sem previsão de preço futuro.</p>
        </div>
        <div class="hero-actions">
          <button class="btn-primary" type="button" data-action="add-investment"><i class="fa-solid fa-plus"></i> Novo investimento</button>
          <a class="btn-secondary" href="#patrimonio"><i class="fa-solid fa-wallet"></i> Ver carteira</a>
        </div>
      </div>

      <div class="detail-stat-grid">
        <div class="detail-stat"><span>Total investido</span><strong>${formatCurrency(totalInvested)}</strong></div>
        <div class="detail-stat"><span>Valor atual</span><strong>${formatCurrency(totalCurrent)}</strong></div>
        <div class="detail-stat"><span>Resultado</span><strong class="${totalProfit >= 0 ? "text-income" : "text-expense"}">${formatCurrency(totalProfit)}</strong></div>
        <div class="detail-stat"><span>Rentabilidade média</span><strong class="${averageReturn >= 0 ? "text-income" : "text-expense"}">${averageReturn >= 0 ? "+" : ""}${averageReturn}%</strong></div>
        <div class="detail-stat"><span>Investimentos</span><strong>${investments.length}</strong></div>
        <div class="detail-stat"><span>Maior posição</span><strong>${highestInvestment.name}</strong></div>
      </div>

      <div class="investment-detail-list">
        ${investments
          .map((investment) => {
            const profit = investment.current - investment.invested;
            const returnClass = profit >= 0 ? "text-income" : "text-expense";
            const simulation = investment.simulation;
            const isFixed = simulation?.kind === "fixed_income";
            const isVariable = simulation?.kind === "variable_income";

            return `
              <section class="premium-card investment-detail-card">
                <div class="card-title-row">
                  <div class="item-left">
                    <span class="investment-icon">${investment.icon}</span>
                    <div>
                      <h2 class="item-title">${investment.name}</h2>
                      <p class="item-meta">${investment.category}${investment.assetCode ? ` · ${investment.assetCode}` : ""} · ${investment.institution}</p>
                    </div>
                  </div>
                  <div class="detail-investment-values">
                    <strong>${formatCurrency(investment.current)}</strong>
                    <span class="${returnClass}">${profit >= 0 ? "+" : ""}${formatCurrency(profit)} · ${investment.returnRate >= 0 ? "+" : ""}${investment.returnRate}%</span>
                  </div>
                </div>

                <div class="detail-stat-grid">
                  <div class="detail-stat"><span>Investido</span><strong>${formatCurrency(investment.invested)}</strong></div>
                  <div class="detail-stat"><span>Atual</span><strong>${formatCurrency(investment.current)}</strong></div>
                  <div class="detail-stat"><span>Tipo</span><strong>${investment.investmentType || "—"}</strong></div>
                  <div class="detail-stat"><span>Qtd.</span><strong>${investment.quantity ?? "—"}</strong></div>
                </div>

                ${isFixed ? renderFixedSimulationBlock(simulation) : ""}
                ${isVariable ? renderVariableMarketBlock(simulation, investment.id) : ""}

                <div class="new-expense-actions" style="margin-top:1rem">
                  <button class="expense-secondary-btn" type="button" data-action="edit-investment" data-investment-id="${investment.id}">
                    <i class="fa-solid fa-pen"></i> Editar
                  </button>
                  <button class="expense-secondary-btn" type="button" data-action="delete-investment" data-investment-id="${investment.id}">
                    <i class="fa-solid fa-trash"></i> Excluir
                  </button>
                </div>
              </section>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

export function mountDetailCharts(investments) {
  investments.forEach((investment) => {
    const history = investment.simulation?.market?.history || [];
    if (!history.length) return;
    const el = document.querySelector(`#market-chart-${investment.id}`);
    if (!el) return;

    const recent = history.slice(-90);
    mountChart(
      el,
      chartService.areaChart({
        categories: recent.map((item) =>
          String(item.date).slice(5).replace("-", "/"),
        ),
        series: [
          {
            name: investment.assetCode || investment.name,
            data: recent.map((item) => Number(item.price) || 0),
          },
        ],
        height: 240,
      }),
    );
  });
}
