import { formatCurrency } from "../../utils/currency.js";
import { formatDateLabel, formatMonthYear } from "../../utils/dates.js";
import { invoiceStatusMeta } from "../../utils/labels.js";


export function cardSummary(card) {
  const available = card.totalLimit - card.usedLimit;
  const usedPercent = Math.round((card.usedLimit / card.totalLimit) * 100);

  return `
    <article class="credit-card-panel" style="--card-accent: ${card.color || "#0d6efd"}">
      <div class="credit-card-top">
        <div>
          <span class="page-eyebrow">${card.brand}</span>
          <h3>${card.name}</h3>
          <p>••• ${card.lastDigits}</p>
        </div>
        <i class="fa-solid fa-credit-card"></i>
      </div>
      <div class="credit-card-info">
        <div><span>Limite</span><strong>${formatCurrency(card.totalLimit)}</strong></div>
        <div><span>Fechamento</span><strong>Dia ${card.closingDay}</strong></div>
        <div><span>Vencimento</span><strong>Dia ${card.dueDay}</strong></div>
        <div><span>Fatura Atual</span><strong>${formatCurrency(card.invoiceCurrent)}</strong></div>
      </div>
      <div class="progress-bar">
        <div class="progress credit-progress" style="--progress-width: ${usedPercent}%"></div>
      </div>
      <p class="item-meta">${formatCurrency(available)} disponível</p>
      <div class="card-actions">
        <button class="btn-secondary" type="button" data-action="view-card" data-card-id="${card.id}">Ver detalhes</button>
        <button class="btn-secondary" type="button" data-action="edit-card" data-card-id="${card.id}">Editar</button>
        <button class="btn-danger" type="button" data-action="delete-card" data-card-id="${card.id}">Excluir</button>
      </div>
    </article>
  `;
}

export function invoiceCard(invoice) {
  const meta = invoiceStatusMeta(invoice.status);
  const remaining = Math.max(Number(invoice.total) - Number(invoice.paid), 0);
  const isPaid = invoice.status === "paga";
  const canPay = !isPaid && Number(invoice.total) > 0;

  const monthLabel = formatMonthYear(invoice.referenceMonth);

  return `
    <article class="invoice-card" data-invoice-card="${invoice.id}" data-action="select-invoice" data-invoice-id="${invoice.id}" data-month="${monthLabel}" role="button" tabindex="0" title="Ver compras desta fatura">
      <div class="invoice-card-head">
        <div>
          <strong class="invoice-month">${monthLabel}</strong>
          <p class="item-meta">Vencimento ${formatDateLabel(invoice.dueDate)}</p>
        </div>
        <div class="invoice-head-right">
          <span class="status-pill ${meta.className}">${meta.label}</span>
          <span class="invoice-selected-mark"><i class="fa-solid fa-check"></i></span>
        </div>
      </div>
      <div class="invoice-values">
        <div><span>Total</span><strong>${formatCurrency(invoice.total)}</strong></div>
        <div><span>Pago</span><strong class="text-income">${formatCurrency(invoice.paid)}</strong></div>
        <div><span>Restante</span><strong class="${remaining > 0 ? "amount-negative" : ""}">${formatCurrency(remaining)}</strong></div>
      </div>
      ${
        canPay
          ? `<button class="btn-primary invoice-pay-btn" type="button" data-action="pay-invoice" data-invoice-id="${invoice.id}"><i class="fa-solid fa-check"></i> Pagar fatura</button>`
          : isPaid
            ? `<p class="invoice-paid-note"><i class="fa-solid fa-circle-check"></i> Fatura quitada</p>`
            : ""
      }
    </article>
  `;
}

function purchaseRow({ name, category, date, value, meta }) {
  return `
    <div class="history-item">
      <div>
        <strong class="item-title">${name}</strong>
        <p class="item-meta">${category} • ${formatDateLabel(date)}${meta || ""}</p>
      </div>
      <strong class="amount-negative">${formatCurrency(value)}</strong>
    </div>`;
}

export function renderPurchasesList(purchases) {
  if (!purchases || !purchases.length) {
    return `<div class="empty-state compact"><div><i class="fa-solid fa-cart-shopping"></i><p>Nenhuma compra registrada neste cartão.</p></div></div>`;
  }
  return `<div class="mini-list">${purchases.map((purchase) => purchaseRow(purchase)).join("")}</div>`;
}

export function renderInvoiceItems(items) {
  if (!items || !items.length) {
    return `<div class="empty-state compact"><div><i class="fa-solid fa-receipt"></i><p>Nenhuma compra vinculada a esta fatura.</p></div></div>`;
  }
  return `<div class="mini-list">${items
    .map((item) =>
      purchaseRow({
        name: item.name,
        category: item.category,
        date: item.date,
        value: item.value,
        meta:
          item.installmentsTotal > 1
            ? ` • Parcela ${item.installmentNumber}/${item.installmentsTotal}`
            : "",
      }),
    )
    .join("")}</div>`;
}

export function swapPurchasesContent(html) {
  const list = document.querySelector("#purchasesList");
  if (!list) return;
  list.innerHTML = html;
  list.classList.remove("purchases-swap");
  void list.offsetWidth;
  list.classList.add("purchases-swap");
}

export function restoreAllPurchases(cardDetailData) {
  const title = document.querySelector("#purchasesTitle");
  const countPill = document.querySelector("#purchasesCount");
  const clearBtn = document.querySelector("#purchasesClear");
  const purchases = cardDetailData?.purchases || [];
  if (title) title.textContent = "Compras cadastradas";
  if (countPill)
    countPill.textContent = `${purchases.length} ${purchases.length === 1 ? "compra" : "compras"}`;
  clearBtn?.classList.add("is-hidden");
  swapPurchasesContent(renderPurchasesList(purchases));
}

export function render(creditCards) {
  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Cartões</span>
          <h1 class="page-title">Seus cartões organizados em um só lugar.</h1>
          <p class="page-subtitle">Acompanhe limite, vencimento, fechamento e fatura atual sem precisar informar o número completo do cartão.</p>
        </div>
        <button class="btn-primary" type="button" data-action="add-card"><i class="fa-solid fa-plus"></i> Novo Cartão</button>
      </div>

      <div class="cards-grid">${creditCards.map(cardSummary).join("")}</div>
    </section>
  `;
}

export function renderDetail(cardDetailData, creditCards) {
  const card = cardDetailData || creditCards[0];
  if (!card) {
    return `
      <section class="app-page">
        <div class="empty-state">
          <div>
            <i class="fa-solid fa-credit-card"></i>
            <h2 class="font-title-md">Nenhum cartão cadastrado</h2>
            <p>Cadastre um cartão para ver os detalhes aqui.</p>
            <button class="btn-primary" type="button" data-action="add-card"><i class="fa-solid fa-plus"></i> Novo Cartão</button>
          </div>
        </div>
      </section>
    `;
  }

  const available = card.totalLimit - card.usedLimit;
  const invoices = (card.invoices || [])
    .slice()
    .sort((a, b) => new Date(b.referenceMonth) - new Date(a.referenceMonth));
  const openTotal = invoices
    .filter((invoice) => invoice.status !== "paga")
    .reduce((sum, invoice) => sum + Math.max(invoice.total - invoice.paid, 0), 0);
  const purchases = card.purchases || [];

  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Detalhes do cartão</span>
          <h1 class="page-title">${card.name} ••• ${card.lastDigits}</h1>
          <p class="page-subtitle">${card.notes || "Acompanhe limite, vencimentos e faturas cadastradas neste cartão."}</p>
        </div>
        <div class="hero-actions">
          <button class="btn-secondary" type="button" data-action="edit-card" data-card-id="${card.id}"><i class="fa-solid fa-pen"></i> Editar</button>
          <button class="btn-danger" type="button" data-action="delete-card" data-card-id="${card.id}"><i class="fa-solid fa-trash"></i> Excluir</button>
        </div>
      </div>

      <div class="detail-stat-grid">
        <div class="detail-stat"><span>Banco</span><strong>${card.bank}</strong></div>
        <div class="detail-stat"><span>Últimos 3 números</span><strong>••• ${card.lastDigits}</strong></div>
        <div class="detail-stat"><span>Limite</span><strong>${formatCurrency(card.totalLimit)}</strong></div>
        <div class="detail-stat"><span>Limite disponível</span><strong class="text-income">${formatCurrency(available)}</strong></div>
        <div class="detail-stat"><span>Fechamento</span><strong>Dia ${card.closingDay}</strong></div>
        <div class="detail-stat"><span>Vencimento</span><strong>Dia ${card.dueDay}</strong></div>
        <div class="detail-stat"><span>Fatura Atual</span><strong>${formatCurrency(card.invoiceCurrent)}</strong></div>
        <div class="detail-stat"><span>Em aberto</span><strong class="${openTotal > 0 ? "amount-negative" : ""}">${formatCurrency(openTotal)}</strong></div>
      </div>

      <section class="premium-card">
        <div class="card-title-row">
          <h2>Faturas</h2>
          <span class="pill">${invoices.length} ${invoices.length === 1 ? "fatura" : "faturas"}</span>
        </div>
        ${
          invoices.length
            ? `<div class="invoices-grid">${invoices.map(invoiceCard).join("")}</div>`
            : `<div class="empty-state compact"><div><i class="fa-solid fa-file-invoice-dollar"></i><p>Nenhuma fatura gerada ainda. Faça uma compra neste cartão para gerar a primeira fatura.</p></div></div>`
        }
      </section>

      <section class="premium-card">
        <div class="card-title-row">
          <h2 id="purchasesTitle">Compras cadastradas</h2>
          <div class="purchases-head-right">
            <button class="purchases-clear is-hidden" id="purchasesClear" type="button" data-action="clear-invoice-filter"><i class="fa-solid fa-xmark"></i> Ver todas</button>
            <span class="pill" id="purchasesCount">${purchases.length} ${purchases.length === 1 ? "compra" : "compras"}</span>
          </div>
        </div>
        <div id="purchasesList">${renderPurchasesList(purchases)}</div>
      </section>
    </section>
  `;
}
