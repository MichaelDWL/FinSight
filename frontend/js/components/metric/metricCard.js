/**
 * Metric card + trend badge reutilizáveis.
 */

export function trendBadge(trend, tone = "brand") {
  if (!trend) return "";

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

export function metricCard(label, value, icon, caption, tone = "brand", trend = null) {
  const toneClass =
    tone === "income"
      ? "text-income"
      : tone === "expense"
        ? "text-expense"
        : "text-brand";

  const trendHtml = trend ? trendBadge(trend, tone) : "";

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
