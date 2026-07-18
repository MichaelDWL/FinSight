import { chartService, formatBRL } from "../../services/chartService.js";

export function buildOnboardingDonut(items) {
  const labels = items.map((item) => item.category);
  const series = items.map((item) => item.value);
  const colors = items.map((item) => item.color);

  return {
    chart: {
      type: "donut",
      height: 280,
      fontFamily: "Inter, sans-serif",
      toolbar: { show: false },
      animations: { enabled: true, speed: 350 },
    },
    colors,
    labels,
    series,
    legend: {
      position: "bottom",
      fontSize: "12px",
      fontWeight: 500,
      markers: { width: 8, height: 8, radius: 8 },
      itemMargin: { horizontal: 8, vertical: 4 },
    },
    dataLabels: { enabled: false },
    stroke: { width: 2, colors: ["#fff"] },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: "72%",
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: "12px",
              fontWeight: 600,
              color: "#4a5568",
              offsetY: -4,
            },
            value: {
              show: true,
              fontSize: "14px",
              fontWeight: 700,
              color: "#0f2d4f",
              offsetY: 4,
              formatter: (value) => formatBRL(value),
            },
            total: {
              show: true,
              showAlways: true,
              label: "Total",
              fontSize: "12px",
              fontWeight: 600,
              color: "#4a5568",
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
        formatter: (value) => formatBRL(value),
      },
    },
    responsive: [
      {
        breakpoint: 640,
        options: {
          chart: { height: 260 },
          legend: { position: "bottom" },
        },
      },
    ],
  };
}

export function buildOnboardingBars(items) {
  return {
    ...chartService.barChart({
      categories: items.map((item) => item.category),
      series: [{ name: "Valor", data: items.map((item) => item.value) }],
      colors: items.map((item) => item.color),
      height: 280,
    }),
    legend: { show: false },
    chart: {
      type: "bar",
      height: 280,
      fontFamily: "Inter, sans-serif",
      toolbar: { show: false },
      animations: { enabled: true, speed: 350 },
    },
    plotOptions: {
      bar: {
        borderRadius: 8,
        columnWidth: "52%",
        distributed: true,
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: items.map((item) => item.category),
      labels: {
        rotate: -25,
        style: { fontSize: "11px" },
      },
    },
    yaxis: {
      labels: {
        formatter: (value) => formatBRL(value),
      },
    },
  };
}
