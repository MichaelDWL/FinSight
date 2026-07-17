const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const { getCurrentUserId } = require("../../utils/demoUser");
const { runWithSqlTracking } = require("./monitoring/sql.tracker");
const { createBffMonitor, countRecords } = require("./monitoring/bff.monitor");

const homeBffService = require("./services/home.bff.service");
const dashboardBffService = require("./services/dashboard.bff.service");
const investmentsBffService = require("./services/investments.bff.service");
const accountsBffService = require("./services/accounts.bff.service");
const cardsBffService = require("./services/cards.bff.service");
const transactionsBffService = require("./services/transactions.bff.service");
const reportsBffService = require("./services/reports.bff.service");
const insightsBffService = require("./services/insights.bff.service");

function createHandler(endpoint, serviceFn, message) {
  return asyncHandler(async (req, res) => {
    const userId = getCurrentUserId(req);
    const monitor = createBffMonitor(endpoint, { userId });

    const { data, cacheHit } = await runWithSqlTracking(() =>
      serviceFn(userId, req.query || {}),
    );

    monitor.setCacheHit(cacheHit);
    monitor.setRecordCount(countRecords(data));

    const payload = monitor.measureSerialize(() => data);
    monitor.finish(res, payload);

    return success(res, {
      message,
      data: payload,
    });
  });
}

const home = createHandler("home", homeBffService.getHome, "Home carregada.");
const dashboard = createHandler(
  "dashboard",
  dashboardBffService.getDashboard,
  "Dashboard carregado.",
);
const investments = createHandler(
  "investments",
  investmentsBffService.getInvestments,
  "Investimentos carregados.",
);
const accounts = createHandler(
  "accounts",
  accountsBffService.getAccounts,
  "Contas carregadas.",
);
const cards = createHandler("cards", cardsBffService.getCards, "Cartoes carregados.");
const transactions = createHandler(
  "transactions",
  transactionsBffService.getTransactions,
  "Transacoes carregadas.",
);
const reports = createHandler(
  "reports",
  reportsBffService.getReports,
  "Relatorios carregados.",
);
const insights = createHandler(
  "insights",
  insightsBffService.getInsights,
  "Insights carregados.",
);

module.exports = {
  home,
  dashboard,
  investments,
  accounts,
  cards,
  transactions,
  reports,
  insights,
};
