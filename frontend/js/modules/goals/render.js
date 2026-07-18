import { formatCurrency } from "../../utils/currency.js";

export function progressPercent(goal) {
  return Math.min(Math.round((goal.current / goal.desired) * 100), 100);
}

export function goalCard(goal) {
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

export function render(goals) {
  return `
    <section class="app-page">
      <div class="page-hero">
        <div>
          <span class="page-eyebrow">Metas financeiras</span>
          <h1 class="page-title">Objetivos claros motivam escolhas melhores.</h1>
          <p class="page-subtitle">Cada meta mostra valor desejado, valor atual, progresso e data prevista em cards fáceis de acompanhar.</p>
        </div>
        <button class="btn-primary" type="button" data-action="add-goal"><i class="fa-solid fa-plus"></i> Adicionar meta</button>
      </div>

      <div class="goals-page-grid">${(goals || []).map(goalCard).join("")}</div>
    </section>
  `;
}
