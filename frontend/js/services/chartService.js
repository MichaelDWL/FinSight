const MONTH_LABELS = {
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

function getCssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

export function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);
}

export function monthLabel(label) {
  const key = String(label || "").slice(0, 3);
  return MONTH_LABELS[key] || key;
}

function baseConfig() {
  return {
    chart: {
      fontFamily: "Inter, sans-serif",
      foreColor: getCssVar("--pw6", "#4a5568"),
      toolbar: { show: false },
      animations: { enabled: true, speed: 400 },
    },
    grid: {
      borderColor: getCssVar("--border-color", "#e2e8f0"),
      strokeDashArray: 4,
      padding: { left: 8, right: 8 },
    },
    tooltip: {
      theme: "light",
      y: { formatter: (value) => formatBRL(value) },
    },
    legend: {
      fontSize: "12px",
      fontWeight: 500,
      labels: { colors: getCssVar("--pw6", "#4a5568") },
    },
    dataLabels: { enabled: false },
  };
}

export function mixedFlowChart(monthlyFlow = []) {
  const categories = monthlyFlow.map((item) => monthLabel(item.month));
  const income = monthlyFlow.map((item) => Number(item.income) || 0);
  const expenses = monthlyFlow.map((item) => Number(item.expenses) || 0);
  const balance = monthlyFlow.map((item) => Number(item.balance) || 0);

  const incomeColor = getCssVar("--income", "#14b8a6");
  const expenseColor = getCssVar("--expense", "#ef5d86");
  const brandColor = getCssVar("--brand-accent", "#0d6efd");

  return {
    ...baseConfig(),
    chart: {
      ...baseConfig().chart,
      type: "line",
      height: 320,
      stacked: false,
    },
    colors: [incomeColor, expenseColor, brandColor],
    stroke: { width: [0, 0, 3], curve: "smooth" },
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: "42%",
      },
    },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: "11px" } },
    },
    yaxis: {
      labels: {
        formatter: (value) =>
          value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : formatBRL(value),
      },
    },
    series: [
      { name: "Entradas", type: "column", data: income },
      { name: "Saídas", type: "column", data: expenses },
      { name: "Saldo", type: "line", data: balance },
    ],
  };
}

export function donutChart(items = [], { labelKey = "category", valueKey = "value" } = {}) {
  const labels = items.map((item) => item[labelKey]);
  const series = items.map((item) => Number(item[valueKey]) || 0);
  const colors = items.map(
    (item) => item.color || getCssVar("--brand-accent", "#0d6efd"),
  );

  return {
    ...baseConfig(),
    chart: {
      ...baseConfig().chart,
      type: "donut",
      height: 300,
    },
    colors: colors.length ? colors : [getCssVar("--brand-accent", "#0d6efd")],
    labels,
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              formatter: (w) => {
                const total = w.globals.seriesTotals.reduce((sum, v) => sum + v, 0);
                return formatBRL(total);
              },
            },
          },
        },
      },
    },
    tooltip: {
      y: {
        formatter: (value, { seriesIndex, w }) => {
          const total = w.globals.seriesTotals.reduce((sum, v) => sum + v, 0);
          const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
          return `${formatBRL(value)} (${percent}%)`;
        },
      },
    },
    series,
  };
}

export function barChart({
  categories = [],
  series = [],
  height = 300,
  colors = null,
  horizontal = false,
}) {
  const expenseColor = getCssVar("--expense", "#ef5d86");
  const defaultColors = colors || [expenseColor, getCssVar("--brand-accent", "#0d6efd")];

  return {
    ...baseConfig(),
    chart: {
      ...baseConfig().chart,
      type: "bar",
      height,
    },
    colors: defaultColors,
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: horizontal ? "55%" : "48%",
        horizontal,
      },
    },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: "11px" } },
    },
    yaxis: {
      labels: {
        formatter: (value) =>
          value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : formatBRL(value),
      },
    },
    series,
  };
}

export function areaChart({
  categories = [],
  series = [],
  height = 280,
  colors = null,
}) {
  return {
    ...baseConfig(),
    chart: {
      ...baseConfig().chart,
      type: "area",
      height,
    },
    colors: colors || [getCssVar("--brand-accent", "#0d6efd")],
    stroke: { curve: "smooth", width: 2 },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 0.4,
        opacityFrom: 0.45,
        opacityTo: 0.05,
      },
    },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: "11px" } },
    },
    yaxis: {
      labels: {
        formatter: (value) =>
          value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : formatBRL(value),
      },
    },
    series,
  };
}

export function groupedComparisonChart(items = []) {
  const categories = items.map((item) => item.category);
  const current = items.map((item) => Number(item.currentPeriod) || 0);
  const previous = items.map((item) => Number(item.previousPeriod) || 0);

  return barChart({
    categories,
    series: [
      { name: "Período atual", data: current },
      { name: "Período anterior", data: previous },
    ],
    colors: [getCssVar("--expense", "#ef5d86"), getCssVar("--pw5", "#b1b1b1")],
    height: 320,
  });
}

export function entriesVsExitsChart({ income = 0, expenses = 0 } = {}) {
  const incomeColor = getCssVar("--income", "#14b8a6");
  const expenseColor = getCssVar("--expense", "#ef5d86");

  return {
    ...baseConfig(),
    chart: {
      ...baseConfig().chart,
      type: "bar",
      height: 260,
    },
    colors: [incomeColor, expenseColor],
    plotOptions: {
      bar: {
        borderRadius: 8,
        columnWidth: "38%",
        distributed: true,
      },
    },
    xaxis: {
      categories: ["Entradas", "Saídas"],
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { formatter: (value) => formatBRL(value) },
    },
    legend: { show: false },
    series: [{ name: "Valor", data: [income, expenses] }],
  };
}

export function limitUsageChart(cards = []) {
  const brandColor = getCssVar("--brand-accent", "#0d6efd");
  const warningColor = getCssVar("--warning", "#f5b82e");
  const expenseColor = getCssVar("--expense", "#ef5d86");

  return barChart({
    categories: cards.map((card) => card.cardName),
    series: [{ name: "% utilizado", data: cards.map((card) => card.usagePercent) }],
    colors: cards.map((card) => {
      const percent = Number(card.usagePercent) || 0;
      if (percent >= 80) return expenseColor;
      if (percent >= 50) return warningColor;
      return card.color || brandColor;
    }),
    horizontal: true,
    height: Math.max(cards.length * 58, 220),
  });
}

export function invoiceEvolutionChart(monthlyTotals = [], byCard = []) {
  const categories = monthlyTotals.map((item) => monthLabel(item.month));
  const cardNames = [...new Set(byCard.map((item) => item.cardName))];

  const series = cardNames.map((name) => {
    const cardColor = byCard.find((item) => item.cardName === name)?.cardColor;
    return {
      name,
      data: monthlyTotals.map((month) => {
        const match = byCard.find(
          (item) => item.cardName === name && item.monthStart === month.monthStart,
        );
        return Number(match?.value) || 0;
      }),
      color: cardColor,
    };
  });

  const colors = series.map((item) => item.color || getCssVar("--brand-accent", "#0d6efd"));

  return {
    ...baseConfig(),
    chart: {
      ...baseConfig().chart,
      type: "bar",
      height: 320,
      stacked: false,
    },
    colors,
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: "55%",
      },
    },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        formatter: (value) =>
          value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : formatBRL(value),
      },
    },
    series: series.map(({ name, data }) => ({ name, data })),
  };
}

export function wealthEvolutionChart(evolution = []) {
  const brandColor = getCssVar("--brand-accent", "#0d6efd");
  const incomeColor = getCssVar("--income", "#14b8a6");

  return areaChart({
    categories: evolution.map((item) => monthLabel(item.month)),
    series: [
      { name: "Patrimônio", data: evolution.map((item) => Number(item.patrimonio) || 0) },
      { name: "Aportado", data: evolution.map((item) => Number(item.aportado) || 0) },
    ],
    colors: [brandColor, incomeColor],
    height: 320,
  });
}

export function benchmarkComparisonChart(data = []) {
  const incomeColor = getCssVar("--income", "#14b8a6");
  const brandColor = getCssVar("--brand-accent", "#0d6efd");
  const warningColor = getCssVar("--warning", "#f5b82e");
  const expenseColor = getCssVar("--expense", "#ef5d86");

  const categories = data.map((item) => monthLabel(item.month));

  return {
    ...baseConfig(),
    chart: {
      ...baseConfig().chart,
      type: "line",
      height: 320,
    },
    colors: [incomeColor, brandColor, warningColor, expenseColor],
    stroke: { curve: "smooth", width: 2 },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { formatter: (value) => `${Number(value).toFixed(2)}%` },
    },
    tooltip: {
      y: { formatter: (value) => `${Number(value).toFixed(2)}%` },
    },
    series: [
      { name: "Carteira", data: data.map((item) => Number(item.portfolio) || 0) },
      { name: "CDI", data: data.map((item) => Number(item.cdi) || 0) },
      { name: "Selic", data: data.map((item) => Number(item.selic) || 0) },
      { name: "IPCA", data: data.map((item) => Number(item.ipca) || 0) },
    ],
  };
}

export const chartService = {
  formatBRL,
  monthLabel,
  mixedFlowChart,
  donutChart,
  barChart,
  areaChart,
  groupedComparisonChart,
  entriesVsExitsChart,
  limitUsageChart,
  invoiceEvolutionChart,
  wealthEvolutionChart,
  benchmarkComparisonChart,
};
