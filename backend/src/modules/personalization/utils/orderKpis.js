function orderKpis(kpis = {}, order = []) {
  if (!order?.length) return { ...kpis };

  const ordered = {};
  for (const key of order) {
    if (kpis[key] !== undefined) ordered[key] = kpis[key];
  }
  for (const [key, value] of Object.entries(kpis)) {
    if (ordered[key] === undefined) ordered[key] = value;
  }
  return ordered;
}

function attachPersonalization(payload, personalization, dashboardKey) {
  if (!personalization) {
    return {
      ...payload,
      kpiOrder: Object.keys(payload.kpis || {}),
      personalization: null,
    };
  }

  const kpiOrder =
    personalization?.dashboards?.[dashboardKey]?.kpiOrder ||
    Object.keys(payload.kpis || {});

  return {
    ...payload,
    kpis: orderKpis(payload.kpis, kpiOrder),
    kpiOrder,
    personalization: {
      profileType: personalization.profile?.type,
      profileTitle: personalization.profile?.title,
      homePriority: personalization.home?.priority || [],
    },
    budgets: personalization.budgets || payload.budgets || [],
    progress: personalization.progress || payload.progress || [],
    recommendations: personalization.recommendations || payload.recommendations || [],
    alerts: personalization.alerts || payload.alerts || [],
    healthHistory: personalization.health?.history || null,
  };
}

module.exports = { orderKpis, attachPersonalization };
