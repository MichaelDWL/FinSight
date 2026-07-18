/**
 * Rotas hash da SPA — títulos e leitura de location.hash.
 */

export const routeTitles = {
  dashboard: "Home",
  "dashboards/geral": "Dashboard Geral",
  "dashboards/gastos": "Dashboard de Gastos",
  "dashboards/fluxo-caixa": "Fluxo de Caixa",
  "dashboards/cartoes": "Dashboard de Cartões",
  "dashboards/investimentos": "Dashboard de Investimentos",
  transacoes: "Transações",
  patrimonio: "Patrimônio",
  "investimento-novo": "Adicionar investimento",
  "investimento-detalhe": "Detalhes do investimento",
  "contas-resumo": "Contas",
  "contas-bancos": "Minhas Contas",
  "contas-despesas": "Despesas",
  "contas-cartoes": "Cartões",
  "cartao-detalhe": "Detalhes do cartão",
  "conta-detalhe": "Detalhes da conta",
  metas: "Metas financeiras",
  perfil: "Perfil",
  admin: "Administracao",
};

export function getRoute() {
  const route = window.location.hash.replace("#", "") || "dashboard";

  if (route.startsWith("dashboard/")) {
    return route.replace("dashboard/", "dashboards/");
  }

  if (routeTitles[route]) return route;
  return "dashboard";
}
