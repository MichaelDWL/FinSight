const instances = new Map();

export function mountChart(container, config) {
  if (!container || typeof ApexCharts === "undefined") return null;

  destroyChart(container);

  const chart = new ApexCharts(container, config);
  chart.render();
  instances.set(container, chart);
  return chart;
}

export function destroyChart(container) {
  const chart = instances.get(container);
  if (!chart) return;

  chart.destroy();
  instances.delete(container);
}

export function destroyAllCharts(root = document) {
  root.querySelectorAll("[data-chart]").forEach((container) => {
    destroyChart(container);
  });
  instances.clear();
}

export function resizeCharts(root = document) {
  root.querySelectorAll("[data-chart]").forEach((container) => {
    instances.get(container)?.windowResizeHandler();
  });
}
