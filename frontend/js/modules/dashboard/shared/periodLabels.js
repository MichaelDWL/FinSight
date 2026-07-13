export function periodLabel(period) {
  return (
    {
      "7d": "últimos 7 dias",
      "30d": "últimos 30 dias",
      "3m": "últimos 3 meses",
      "6m": "últimos 6 meses",
      "1y": "último ano",
    }[period] || "período selecionado"
  );
}

export function normalizeDashboardRoute(route) {
  if (!route || route === "dashboards" || route === "dashboards/geral") {
    return "dashboards/geral";
  }

  if (route.startsWith("dashboard/")) {
    return route.replace("dashboard/", "dashboards/");
  }

  return route;
}
